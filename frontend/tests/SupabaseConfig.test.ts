import { afterEach, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

test("configures PKCE, persistence, URL detection and automatic token refresh", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_fixture");
  const { getSupabaseClient } = await import("../src/lib/supabase");
  getSupabaseClient();
  expect(createClient).toHaveBeenCalledWith(
    "https://project.example",
    "sb_publishable_test_fixture",
    {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
});

test("missing public configuration and accidentally supplied secrets fail closed", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  const { getSupabaseClient } = await import("../src/lib/supabase");
  expect(() => getSupabaseClient()).toThrow("Set VITE_SUPABASE_URL");
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_secret_test_fixture");
  expect(() => getSupabaseClient()).toThrow("never a secret key");
  expect(createClient).not.toHaveBeenCalled();
});

test("invalid API URLs fail at setup before constructing an auth client", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_fixture");
  vi.stubEnv("VITE_API_URL", "https://api.example?unexpected=value");
  const { getSupabaseClient } = await import("../src/lib/supabase");
  expect(() => getSupabaseClient()).toThrow("without embedded credentials");
  expect(createClient).not.toHaveBeenCalled();
});
