import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DataProvider } from "../src/app/DataProvider";
import { useData } from "../src/app/dataContext";
import type { TaskInput } from "../src/types/api";

const auth = vi.hoisted(() => {
  const getSession = vi.fn();
  return { getSession, client: { auth: { getSession } } };
});
vi.mock("../src/features/auth/authContext", () => ({
  useAuth: () => ({
    client: auth.client,
    session: { user: { id: "test-user" } },
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const { tasks, reload, mutate, api } = useData();
  const body: TaskInput = {
    title: "Server task",
    description: null,
    course_id: null,
    status: "todo",
    category: "homeworks",
    priority: "medium",
    due_at: null,
  };
  return (
    <>
      <button onClick={() => void reload()}>Refresh</button>
      <button
        onClick={() =>
          void mutate({ kind: "task-save", write: () => api.createTask(body) })
        }
      >
        Create
      </button>
      <div>
        {tasks.map((task) => (
          <p key={task.id}>{task.title}</p>
        ))}
      </div>
    </>
  );
}

test("an older refresh cannot overwrite a later server-confirmed mutation", async () => {
  auth.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "test-user" }, access_token: "test-token" },
    },
    error: null,
  });
  let delaying = false;
  const delayed: (() => void)[] = [];
  const fetch = vi.fn((url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const body = path.endsWith("/me")
      ? { id: "test-user", display_name: null, timezone: "UTC" }
      : { items: [], total: 0, limit: 100, offset: 0 };
    const result = { ok: true, status: 200, json: async () => body };
    if (init.method === "POST")
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          ...JSON.parse(String(init.body)),
          id: "confirmed",
          user_id: "test-user",
          created_at: "2026-10-24T00:00:00Z",
          updated_at: "2026-10-24T00:00:00Z",
          completed_at: null,
        }),
      });
    // Deliberately ignore AbortSignal to simulate a read that has already reached the server.
    if (delaying)
      return new Promise((resolve) => delayed.push(() => resolve(result)));
    return Promise.resolve(result);
  });
  vi.stubGlobal("fetch", fetch);
  render(
    <DataProvider>
      <Harness />
    </DataProvider>,
  );
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  delaying = true;
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(delayed).toHaveLength(3));
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Server task");
  await act(async () => {
    delayed.forEach((resolve) => resolve());
  });
  expect(screen.getByText("Server task")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(7);
});
