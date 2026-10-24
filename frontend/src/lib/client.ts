import type {
  Course,
  CourseInput,
  Page,
  Profile,
  Task,
  TaskInput,
} from "../types/api";

export function apiBaseUrl(
  base = import.meta.env.VITE_API_URL || "http://localhost:8000",
): string {
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("The API must use HTTPS outside localhost.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "Use an API URL without embedded credentials, query, or fragment.",
    );
  return base.replace(/\/$/, "");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export class ApiClient {
  private token: () => Promise<string | null>;
  private base: string;
  constructor(
    token: () => Promise<string | null>,
    base = import.meta.env.VITE_API_URL || "http://localhost:8000",
  ) {
    this.token = token;
    this.base = apiBaseUrl(base);
  }
  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (
      !(import.meta.env.DEV && import.meta.env.VITE_DEV_PERF_TIMING === "true")
    ) {
      return this.send<T>(path, method, body, signal);
    }
    const start = performance.now();
    const route = path.split("?")[0];
    const resource = ["/me", "/courses", "/tasks"].includes(route)
      ? route
      : /^\/(tasks|courses)\/[^/]+$/.test(route)
        ? `/${route.split("/")[1]}/:id`
        : "<other>";
    try {
      return await this.send<T>(path, method, body, signal);
    } finally {
      console.debug("[dev-performance]", {
        method,
        resource,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  }
  private async send<T>(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    let token: string | null;
    try {
      token = await this.token();
    } catch {
      throw new ApiError(
        401,
        "Your session has expired. Please sign in again.",
      );
    }
    if (!token)
      throw new ApiError(
        401,
        "Your session has expired. Please sign in again.",
      );
    let response: Response;
    try {
      response = await fetch(this.base + "/api/v1" + path, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(
        0,
        "Unable to reach the API. Check your connection and retry.",
      );
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Your session has expired. Please sign in again.",
        403: "Access denied.",
        404: "This item no longer exists or is not accessible.",
        409: "The item changed. Refresh and try again.",
        422: "Please check the form values and deadline timezone.",
        503: "The service is not configured or is temporarily unavailable.",
      };
      throw new ApiError(
        response.status,
        messages[response.status] || "The request failed. Please retry.",
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  async all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const items: T[] = [];
    while (true) {
      const page = await this.request<Page<T>>(
        `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${items.length}`,
        "GET",
        undefined,
        signal,
      );
      items.push(...page.items);
      if (!page.items.length || items.length >= page.total) return items;
    }
  }
  profile = (signal?: AbortSignal) =>
    this.request<Profile>("/me", "GET", undefined, signal);
  updateProfile = (body: Pick<Profile, "display_name" | "timezone">) =>
    this.request<Profile>("/me", "PATCH", body);
  courses = (signal?: AbortSignal) => this.all<Course>("/courses", signal);
  tasks = (signal?: AbortSignal) => this.all<Task>("/tasks", signal);
  createTask = (body: TaskInput) => this.request<Task>("/tasks", "POST", body);
  updateTask = (id: string, body: Partial<TaskInput>) =>
    this.request<Task>(`/tasks/${encodeURIComponent(id)}`, "PATCH", body);
  deleteTask = (id: string) =>
    this.request<void>(`/tasks/${encodeURIComponent(id)}`, "DELETE");
  createCourse = (body: CourseInput) =>
    this.request<Course>("/courses", "POST", body);
  updateCourse = (id: string, body: CourseInput) =>
    this.request<Course>(`/courses/${encodeURIComponent(id)}`, "PATCH", body);
  deleteCourse = (id: string) =>
    this.request<void>(`/courses/${encodeURIComponent(id)}`, "DELETE");
}
