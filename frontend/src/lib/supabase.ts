import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;
export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable sign-in.",
    );
  const api = new URL(import.meta.env.VITE_API_URL || "http://localhost:8000");
  if (
    api.protocol !== "https:" &&
    !(
      api.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(api.hostname)
    )
  )
    throw new Error("The API must use HTTPS outside localhost.");
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname)
  )
    throw new Error(
      "Use a Supabase project origin without credentials or paths.",
    );
  if (
    parsed.protocol !== "https:" &&
    !(import.meta.env.DEV && parsed.hostname === "localhost")
  ) {
    throw new Error("Supabase requires an HTTPS project URL.");
  }
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a public publishable key, never a secret key.");
  if (key.split(".").length === 3) {
    let role: string | undefined;
    try {
      role = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role;
    } catch {
      throw new Error("Invalid public key configuration.");
    }
    if (role !== "anon")
      throw new Error("Only a public anon or publishable key is allowed.");
  }
  cached = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}
