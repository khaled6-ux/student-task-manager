import { afterEach, expect, test, vi } from "vitest";
import { ApiClient } from "../src/lib/client";
import { dayKey, instantFromLocal, localInput } from "../src/lib/dates";

afterEach(() => vi.unstubAllGlobals());

test("loads every backend page and obtains a fresh token per request", async () => {
  const token = vi
    .fn()
    .mockResolvedValueOnce("first-test-token")
    .mockResolvedValueOnce("second-test-token");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [1, 2], total: 3 }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [3], total: 3 }),
    });
  vi.stubGlobal("fetch", fetch);
  const client = new ApiClient(token, "http://localhost:8000/");
  expect(await client.all("/tasks?category=projects")).toEqual([1, 2, 3]);
  expect(fetch.mock.calls[0][0]).toBe(
    "http://localhost:8000/api/v1/tasks?category=projects&limit=100&offset=0",
  );
  expect(fetch.mock.calls[1][0]).toContain("offset=2");
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer second-test-token",
  );
});

test("does not send requests without a session and handles API failures", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(new ApiClient(async () => null).tasks()).rejects.toMatchObject({
    status: 401,
  });
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue({ ok: false, status: 401 });
  await expect(new ApiClient(async () => "test-token").tasks()).rejects.toThrow(
    "Your session has expired",
  );
  fetch.mockRejectedValue(new Error("network details"));
  await expect(new ApiClient(async () => "test-token").tasks()).rejects.toThrow(
    "Unable to reach the API",
  );
});

test("rejects insecure remote API origins", () => {
  expect(
    () => new ApiClient(async () => null, "http://remote.example"),
  ).toThrow("HTTPS");
});

test("date-only grouping respects profile timezone and DST boundaries", () => {
  expect(dayKey("2026-10-22T18:00:00Z", "Asia/Shanghai")).toBe("2026-10-23");
  expect(dayKey("2026-10-22T18:00:00Z", "America/Los_Angeles")).toBe(
    "2026-10-22",
  );
  expect(dayKey("2026-03-08T09:59:00Z", "America/Los_Angeles")).toBe(
    "2026-03-08",
  );
  expect(dayKey("2026-03-08T10:01:00Z", "America/Los_Angeles")).toBe(
    "2026-03-08",
  );
  expect(instantFromLocal("", "UTC")).toBeNull();
  expect(localInput(instantFromLocal("2026-10-23T12:30", "UTC"), "UTC")).toBe(
    "2026-10-23T12:30",
  );
  expect(() => instantFromLocal("invalid", "UTC")).toThrow("Choose a valid");
});

test("development timing redacts identifiers, queries, bodies and tokens and is off in production", async () => {
  const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
  );
  vi.stubEnv("VITE_DEV_PERF_TIMING", "true");
  vi.stubEnv("DEV", true);
  try {
    const api = new ApiClient(async () => "private-test-token");
    await api.request("/tasks/private-id?title=private-query", "PATCH", {
      title: "private-body",
    });
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      resource: "/tasks/:id",
    });
    const logged = JSON.stringify(debug.mock.calls);
    for (const secret of [
      "private-test-token",
      "private-id",
      "private-query",
      "private-body",
    ])
      expect(logged).not.toContain(secret);
    debug.mockClear();
    vi.stubEnv("DEV", false);
    await api.request("/me");
    expect(debug).not.toHaveBeenCalled();
  } finally {
    debug.mockRestore();
    vi.unstubAllEnvs();
  }
});
