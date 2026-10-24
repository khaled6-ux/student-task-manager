// Public build inputs only. Never include a config value in an error message.
export function validateProductionConfig(env: Record<string, unknown>) {
  const origin = (name: string, allowPath = false) => {
    try {
      const url = new URL(String(env[name] || ""));
      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        (!allowPath && !["", "/"].includes(url.pathname))
      )
        throw new Error();
    } catch {
      throw new Error(`${name} must be an explicit public HTTPS URL`);
    }
  };
  origin("VITE_API_URL", true);
  origin("VITE_SUPABASE_URL");
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  let publicKey =
    key.startsWith("sb_publishable_") && key.length > "sb_publishable_".length;
  if (key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(
          atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).role === "anon";
    } catch {
      publicKey = false;
    }
  }
  if (!publicKey)
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY must be a public publishable or anon key",
    );
  if (env.VITE_DEMO_MODE === "true")
    throw new Error("Production must not enable VITE_DEMO_MODE");
}
