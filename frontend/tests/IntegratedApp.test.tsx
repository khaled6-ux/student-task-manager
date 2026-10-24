import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import App from "../src/App";
import { getSupabaseClient } from "../src/lib/supabase";
import type { Course, Task } from "../src/types/api";

vi.mock("../src/lib/supabase", () => ({ getSupabaseClient: vi.fn() }));
const userId = "00000000-0000-4000-8000-000000000001";
const session = {
  access_token: "test-access-token",
  user: { id: userId },
} as Session;
let current: Session | null;
let listener: (event: string, value: Session | null) => void;
let auth: {
  getSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
};
let courses: Course[];
let tasks: Task[];
let fetchMock: ReturnType<typeof vi.fn>;
let failLoading = false;
const stamp = "2026-10-01T00:00:00Z";
const unsubscribe = vi.fn();
const profile = {
  id: userId,
  display_name: "Student",
  timezone: "Asia/Shanghai",
};
const response = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => structuredClone(data),
  } as Response);
const emit = (value: Session | null) =>
  act(() => {
    current = value;
    listener(value ? "TOKEN_REFRESHED" : "SIGNED_OUT", value);
  });
const navigate = (path: string) =>
  act(() => {
    window.history.replaceState(null, "", `#${path}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-23T04:00:00Z"));
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_URL", "http://localhost:8000");
  window.history.replaceState(null, "", "/");
  Object.assign(profile, {
    display_name: "Student",
    timezone: "Asia/Shanghai",
  });
  current = session;
  failLoading = false;
  courses = [
    {
      id: "course-1",
      user_id: userId,
      name: "Mathematics",
      code: "MATH",
      color: "#226b55",
      created_at: stamp,
      updated_at: stamp,
    },
  ];
  tasks = [
    {
      id: "task-1",
      user_id: userId,
      course_id: "course-1",
      title: "Worksheet",
      description: null,
      category: "homeworks",
      status: "todo",
      priority: "medium",
      due_at: "2026-10-22T18:00:00Z",
      completed_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
  ];
  auth = {
    getSession: vi.fn(async () => ({
      data: { session: current },
      error: null,
    })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => {
      current = null;
      return { error: null };
    }),
  };
  vi.mocked(getSupabaseClient).mockReturnValue({
    auth,
  } as unknown as SupabaseClient);
  fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.replace("/api/v1", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (failLoading && method === "GET") return response({}, 503);
    if (path === "/me") {
      if (body) Object.assign(profile, body);
      return response(profile);
    }
    const store = path.startsWith("/courses") ? courses : tasks;
    if (method === "GET") {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return response({
        items: store.slice(offset, offset + 100),
        total: store.length,
        offset,
        limit: 100,
      });
    }
    if (method === "POST") {
      const item = {
        ...body,
        id: `new-${store.length}`,
        user_id: userId,
        completed_at: null,
        created_at: stamp,
        updated_at: stamp,
      };
      (store as unknown[]).push(item);
      return response(item, 201);
    }
    const id = path.split("/").pop();
    const index = store.findIndex((item) => item.id === id);
    if (index < 0) return response({}, 404);
    if (method === "DELETE") {
      if (path.startsWith("/courses/"))
        tasks = tasks.map((task) =>
          task.course_id === id
            ? { ...task, course_id: null, updated_at: "2026-10-24T00:00:00Z" }
            : task,
        );
      store.splice(index, 1);
      return response(null, 204);
    }
    Object.assign(store[index], body);
    return response(store[index]);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

async function open() {
  render(<App />);
  await screen.findByRole("heading", { name: "Your semester, organized." });
}

test("protects routes and starts Google OAuth without fetching private data", async () => {
  current = null;
  render(<App />);
  const button = await screen.findByRole("button", {
    name: "Continue with Google",
  });
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: window.location.origin + "/" },
  });
});

test("shows authentication loading, then restores a signed-in session", async () => {
  let restore: (value: unknown) => void = () => undefined;
  auth.getSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
  );
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Restoring your session",
  );
  await act(async () => restore({ data: { session }, error: null }));
  await screen.findByText("Worksheet");
});

test("auth events refresh bearer tokens and sign-out removes protected content", async () => {
  await open();
  emit({ ...session, access_token: "refreshed-test-token" });
  fireEvent.click(screen.getByRole("button", { name: "Complete Worksheet" }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([, init]) =>
          init?.method === "PATCH" &&
          init.headers.Authorization === "Bearer refreshed-test-token",
      ),
    ).toBe(true),
  );
  await screen.findByRole("button", { name: "Reopen Worksheet" });
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("button", { name: "Continue with Google" });
  expect(screen.queryByText("Worksheet")).not.toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalled();
});

test("new authenticated user never sees previous user data while loading", async () => {
  await open();
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
  tasks = [];
  emit({ ...session, user: { ...session.user, id: "other-user" } });
  expect(screen.queryByText("Worksheet")).not.toBeInTheDocument();
  await screen.findByText("No tasks here yet.");
});

test("displays sign-in and sign-out errors without fabricating a session", async () => {
  current = null;
  auth.signInWithOAuth.mockResolvedValue({ error: new Error("test failure") });
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Continue with Google" }),
  );
  await screen.findByText("Google sign-in failed. Please try again.");
  emit(session);
  await screen.findByText("Worksheet");
  auth.signOut.mockResolvedValue({ error: new Error("test failure") });
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByText("Sign-out failed. Please try again.");
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
});

test("missing configuration and API failures never fall back to demo data", async () => {
  vi.mocked(getSupabaseClient).mockImplementationOnce(() => {
    throw new Error("Missing public configuration");
  });
  const view = render(<App />);
  expect(
    await screen.findByText("Missing public configuration"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Practice integration techniques"),
  ).not.toBeInTheDocument();
  view.unmount();
  failLoading = true;
  render(<App />);
  await screen.findByText(
    "The service is not configured or is temporarily unavailable.",
  );
  expect(screen.queryByText("Worksheet")).not.toBeInTheDocument();
  failLoading = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  await screen.findByText("Worksheet");
});

test("creates, edits, completes, and confirms deletion of a persisted task", async () => {
  await open();
  fetchMock.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "New task" }));
  let form = screen.getByRole("form", { name: "Create task" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "  Build project  " },
  });
  fireEvent.change(within(form).getByLabelText("Category"), {
    target: { value: "projects" },
  });
  fireEvent.change(within(form).getByLabelText("Course"), {
    target: { value: "course-1" },
  });
  fireEvent.submit(form);
  await screen.findByRole("button", { name: "Edit Build project" });
  const post = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "POST",
  )![1];
  expect(JSON.parse(post.body)).toMatchObject({
    title: "Build project",
    category: "projects",
    course_id: "course-1",
  });
  expect(JSON.parse(post.body)).not.toHaveProperty("user_id");
  fireEvent.click(screen.getByRole("button", { name: "Edit Build project" }));
  form = screen.getByRole("form", { name: "Edit task" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "Updated project" },
  });
  fireEvent.submit(form);
  await screen.findByRole("button", { name: "Complete Updated project" });
  fireEvent.click(
    screen.getByRole("button", { name: "Complete Updated project" }),
  );
  await screen.findByRole("button", { name: "Reopen Updated project" });
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Updated project" }),
  );
  expect(tasks.some((task) => task.title === "Updated project")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Updated project" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() =>
    expect(tasks.some((task) => task.title === "Updated project")).toBe(false),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Edit Updated project" }),
    ).not.toBeInTheDocument(),
  );
  expect(
    fetchMock.mock.calls.filter(([, init]) => init?.method === "GET"),
  ).toHaveLength(0);
});

test("validates task forms and surfaces server failures", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "New task" }));
  const form = screen.getByRole("form", { name: "Create task" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "   " },
  });
  fireEvent.submit(form);
  await screen.findByText("Enter a task title.");
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "Valid" },
  });
  fetchMock.mockImplementationOnce(() => response({}, 422));
  fireEvent.submit(form);
  await screen.findByText(
    "Please check the form values and deadline timezone.",
  );
  expect(screen.getByRole("form", { name: "Create task" })).toBeInTheDocument();
});

test("creates, edits and deletes courses with confirmation", async () => {
  await open();
  navigate("/courses");
  fireEvent.click(screen.getByRole("button", { name: "New course" }));
  let form = screen.getByRole("form", { name: "Create course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Physics" },
  });
  fireEvent.change(within(form).getByLabelText("Code"), {
    target: { value: "PHY" },
  });
  fireEvent.submit(form);
  fireEvent.click(await screen.findByRole("button", { name: "Edit Physics" }));
  form = screen.getByRole("form", { name: "Edit course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Physics II" },
  });
  fireEvent.submit(form);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete Physics II" }),
  );
  expect(screen.getByText(/Its tasks will be retained/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm delete course" }),
  );
  await waitFor(() =>
    expect(courses.some((course) => course.name === "Physics II")).toBe(false),
  );
});

test("filters all five categories and preserves course-specific pages", async () => {
  await open();
  navigate("/sections/exams");
  expect(screen.queryByText("Worksheet")).not.toBeInTheDocument();
  expect(screen.getByText("No tasks here yet.")).toBeInTheDocument();
  navigate("/sections/homeworks");
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
  for (const name of [
    "Homeworks",
    "Exams",
    "Finals",
    "Projects",
    "Presentations",
  ])
    expect(screen.getByRole("link", { name })).toBeInTheDocument();
  navigate("/courses/course-1");
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
  navigate("/sections/missing");
  expect(
    screen.getByRole("heading", { name: "Section not found" }),
  ).toBeInTheDocument();
});

test("calendar groups API deadlines by profile timezone and supports month navigation", async () => {
  await open();
  navigate("/calendar");
  // The UTC deadline is October 22, but October 23 in Asia/Shanghai.
  const expected = "October 2026";
  let attempts = 0;
  // Navigate from the real current month without freezing Supabase or request timers.
  while (
    !screen.queryByRole("heading", { name: expected }) &&
    attempts++ < 60
  ) {
    const label = screen.getByRole("heading", { level: 2 }).textContent!;
    const month = Date.parse("1 " + label);
    fireEvent.click(
      screen.getByRole("button", {
        name:
          month < Date.parse("2026-10-01") ? "Next month" : "Previous month",
      }),
    );
  }
  fireEvent.click(screen.getByRole("button", { name: "2026-10-23, 1 tasks" }));
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2026-10-22, 0 tasks" }));
  expect(screen.queryByText("Worksheet")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(
    screen.getByRole("heading", { name: "November 2026" }),
  ).toBeInTheDocument();
});

test("updates profile using the existing API contract", async () => {
  await open();
  navigate("/profile");
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Alex" },
  });
  fireEvent.change(screen.getByLabelText("Timezone"), {
    target: { value: "UTC" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url.endsWith("/me") &&
          init?.method === "PATCH" &&
          JSON.parse(init.body).display_name === "Alex",
      ),
    ).toBe(true),
  );
  await screen.findByText("Alex / Profile");
});

test("production refuses development demo mode", () => {
  vi.stubEnv("VITE_DEMO_MODE", "true");
  vi.stubEnv("DEV", false);
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Configuration error" }),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("session restoration errors remain on the sign-in screen", async () => {
  auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: new Error("test failure"),
  });
  const view = render(<App />);
  await screen.findByText(
    "Unable to restore your session. Please sign in again.",
  );
  expect(
    screen.getByRole("button", { name: "Continue with Google" }),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test("initial auth snapshot does not suppress a session restoration error", async () => {
  let restore: (value: unknown) => void = () => undefined;
  auth.getSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
  );
  render(<App />);
  act(() => {
    current = null;
    listener("INITIAL_SESSION", null);
  });
  await act(async () =>
    restore({ data: { session: null }, error: new Error("test failure") }),
  );
  await screen.findByText(
    "Unable to restore your session. Please sign in again.",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("calendar retains month and day after a task mutation reloads data", async () => {
  tasks.push({
    ...tasks[0],
    id: "november-task",
    title: "November project",
    category: "projects",
    due_at: "2026-11-03T03:00:00Z",
  });
  await open();
  navigate("/calendar");
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: "2026-11-03, 1 tasks" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Complete November project" }),
  );
  await screen.findByRole("button", { name: "Reopen November project" });
  expect(
    screen.getByRole("heading", { name: "November 2026" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Tasks for 2026-11-03" }),
  ).toBeInTheDocument();
});

test.each([
  "homeworks",
  "exams",
  "finals",
  "projects",
  "presentations",
] as const)(
  "category page %s shows only its matching API tasks",
  async (category) => {
    const item = {
      ...tasks[0],
      id: "category-task",
      title: "Unique category task",
      category,
    };
    tasks = [
      item,
      {
        ...tasks[0],
        id: "other-category-task",
        title: "Other category task",
        category: category === "homeworks" ? "exams" : "homeworks",
      },
    ];
    await open();
    navigate(`/sections/${category}`);
    expect(screen.getByText("Unique category task")).toBeInTheDocument();
    expect(screen.queryByText("Other category task")).not.toBeInTheDocument();
  },
);

test("course creation uses the confirmed response, saves immediately and does not refetch", async () => {
  await open();
  navigate("/courses");
  fireEvent.click(screen.getByRole("button", { name: "New course" }));
  const form = screen.getByRole("form", { name: "Create course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Physics" },
  });
  fetchMock.mockClear();
  let finish: (value: Response) => void = () => undefined;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByText("Saving changes…")).toBeInTheDocument();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(
    screen.queryByRole("button", { name: "Edit Physics" }),
  ).not.toBeInTheDocument();
  await act(async () =>
    finish(
      await response(
        { ...courses[0], id: "new-confirmed", name: "Physics (server)" },
        201,
      ),
    ),
  );
  await screen.findByRole("button", { name: "Edit Physics (server)" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Saving changes…")).not.toBeInTheDocument();
});

test("course update, profile update and empty course deletion avoid unrelated reads", async () => {
  courses.push({ ...courses[0], id: "empty-course", name: "Empty course" });
  await open();
  navigate("/courses");
  fetchMock.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Edit Mathematics" }));
  const form = screen.getByRole("form", { name: "Edit course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Advanced Mathematics" },
  });
  fireEvent.submit(form);
  await screen.findByRole("button", { name: "Edit Advanced Mathematics" });
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual([
    "PATCH",
  ]);
  navigate("/profile");
  fetchMock.mockClear();
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Pat" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Pat / Profile");
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual([
    "PATCH",
  ]);
  navigate("/courses");
  fetchMock.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Delete Empty course" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm delete course" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Delete Empty course" }),
    ).not.toBeInTheDocument(),
  );
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual([
    "DELETE",
  ]);
});

test("course deletion refreshes only linked tasks, keeping server timestamps", async () => {
  await open();
  navigate("/courses");
  fetchMock.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Delete Mathematics" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm delete course" }),
  );
  await screen.findByText("No courses yet. Create your first course.");
  await waitFor(() =>
    expect(screen.queryByText("Saving changes…")).not.toBeInTheDocument(),
  );
  expect(
    fetchMock.mock.calls.map(([url, init]) => [
      new URL(url).pathname,
      init.method,
    ]),
  ).toEqual([
    ["/api/v1/courses/course-1", "DELETE"],
    ["/api/v1/tasks", "GET"],
  ]);
  navigate("/");
  expect(screen.getByText("No course · 1 tasks")).toBeInTheDocument();
});

test("failed task write retains data and form, reenables save and performs no GET", async () => {
  await open();
  fetchMock.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Edit Worksheet" }));
  const form = screen.getByRole("form", { name: "Edit task" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "Unsaved title" },
  });
  fetchMock.mockImplementationOnce(() => response({}, 503));
  fireEvent.submit(form);
  await screen.findByText(
    "The service is not configured or is temporarily unavailable.",
  );
  expect(screen.getByRole("button", { name: "Save task" })).toBeEnabled();
  expect(screen.getByText("Worksheet")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit Unsaved title" }),
  ).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual([
    "PATCH",
  ]);
});

test("successful course delete with failed linked read does not repeat deletion", async () => {
  await open();
  navigate("/courses");
  fetchMock.mockClear();
  failLoading = true;
  fireEvent.click(screen.getByRole("button", { name: "Delete Mathematics" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm delete course" }),
  );
  await screen.findByText(
    "Course deleted, but linked tasks could not be refreshed. Retry loading before making further changes.",
  );
  expect(
    screen.queryByRole("button", { name: "Delete Mathematics" }),
  ).not.toBeInTheDocument();

  const callsAfterDelete = fetchMock.mock.calls.length;
  navigate("/");
  fireEvent.click(screen.getByRole("button", { name: "Complete Worksheet" }));
  await screen.findByText("Refresh workspace before making further changes.");
  expect(fetchMock).toHaveBeenCalledTimes(callsAfterDelete);
  failLoading = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  await waitFor(() =>
    expect(screen.queryByText("Refreshing workspace…")).not.toBeInTheDocument(),
  );
  expect(
    fetchMock.mock.calls.filter(([, init]) => init.method === "DELETE"),
  ).toHaveLength(1);
});

test("a mutation response arriving after a user switch cannot populate the next user's cache", async () => {
  await open();
  navigate("/courses");
  fireEvent.click(screen.getByRole("button", { name: "New course" }));
  const form = screen.getByRole("form", { name: "Create course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Private A" },
  });
  let finish: (value: Response) => void = () => undefined;
  const oldCourse = { ...courses[0], id: "late-private", name: "Private A" };
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.submit(form);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled(),
  );
  courses = [];
  tasks = [];
  emit({ ...session, user: { ...session.user, id: "other-user" } });
  await screen.findByText("No courses yet. Create your first course.");
  await act(async () => finish(await response(oldCourse, 201)));
  expect(
    screen.queryByRole("button", { name: "Edit Private A" }),
  ).not.toBeInTheDocument();
});

test("failed course write keeps the form and data without a reload", async () => {
  await open();
  navigate("/courses");
  fireEvent.click(screen.getByRole("button", { name: "New course" }));
  const form = screen.getByRole("form", { name: "Create course" });
  fireEvent.change(within(form).getByLabelText("Name"), {
    target: { value: "Not saved" },
  });
  fetchMock.mockClear();
  fetchMock.mockImplementationOnce(() => response({}, 503));
  fireEvent.submit(form);
  await screen.findByText(
    "The service is not configured or is temporarily unavailable.",
  );
  expect(screen.getByRole("button", { name: "Save course" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Edit Mathematics" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit Not saved" }),
  ).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["POST"]);
});
