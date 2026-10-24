import { afterEach, expect, test, vi } from "vitest";
import { validateProductionConfig } from "../src/lib/productionConfig";
import { ApiClient, ApiError } from "../src/lib/client";
const valid = {
  VITE_API_URL: "https://api.example.test",
  VITE_SUPABASE_URL: "https://project.example.test",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_PLACEHOLDER",
  VITE_DEMO_MODE: "false",
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("valid public production configuration passes without real credentials", () => {
  expect(() => validateProductionConfig(valid)).not.toThrow();
});
test.each([
  { VITE_API_URL: undefined },
  { VITE_API_URL: "http://localhost:8000" },
  { VITE_API_URL: "https://user:PRIVATE_VALUE@api.example.test" },
  { VITE_SUPABASE_URL: "http://project.example.test" },
  { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_PRIVATE_VALUE" },
  { VITE_DEMO_MODE: "true" },
])(
  "invalid production configuration fails without exposing values: %j",
  (changes) => {
    try {
      validateProductionConfig({ ...valid, ...changes });
      throw new Error("should reject");
    } catch (error) {
      expect(String(error)).not.toContain("PRIVATE_VALUE");
      expect(String(error)).not.toContain("should reject");
    }
  },
);
test("read timeout releases the caller without retrying", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(
    (_input: string, _init?: RequestInit) => new Promise<Response>(() => {}),
  );
  vi.stubGlobal("fetch", fetch);
  const result = new ApiClient(
    async () => "fixture-token",
    "https://api.example.test",
  ).profile();
  const rejection = expect(result).rejects.toMatchObject({
    status: 408,
    uncertain: false,
  });
  await vi.advanceTimersByTimeAsync(20001);
  await rejection;
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("timed-out mutations are uncertain, aborted and never automatically replayed", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(
    (_input: string, _init?: RequestInit) => new Promise<Response>(() => {}),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new ApiClient(
    async () => "fixture-token",
    "https://api.example.test",
  );
  const result = client.deleteTask("fixture-id");
  const rejection = expect(result).rejects.toMatchObject({
    status: 408,
    uncertain: true,
  });
  await vi.advanceTimersByTimeAsync(20001);
  await rejection;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
test("lost mutation responses are uncertain and require explicit refresh", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("synthetic connection loss");
    }),
  );
  const error = await new ApiClient(
    async () => "fixture-token",
    "https://api.example.test",
  )
    .deleteTask("id")
    .catch((error) => error);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.uncertain).toBe(true);
});
