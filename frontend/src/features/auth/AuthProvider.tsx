import { AuthContext, useAuth } from "./authContext";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [setup] = useState(() => {
    try {
      return { client: getSupabaseClient(), error: "" };
    } catch (error) {
      return {
        client: null,
        error:
          error instanceof Error
            ? error.message
            : "Authentication configuration is invalid.",
      };
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!setup.client);
  const [error, setError] = useState(
    setup.error ||
      (new URLSearchParams(window.location.search).has("error")
        ? "Google sign-in could not be completed. Please try again."
        : ""),
  );
  useEffect(() => {
    const client = setup.client;
    if (!client) return;
    let active = true;
    let authEventReceived = false;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) {
        authEventReceived = true;
        setSession(next);
        setLoading(false);
      }
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;
        if (error)
          setError("Unable to restore your session. Please sign in again.");
        setSession(error ? null : data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Unable to restore your session. Please sign in again.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [setup.client]);
  const signIn = async () => {
    if (!setup.client) return;
    setError("");
    try {
      const { error } = await setup.client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
  };
  const logout = async () => {
    if (!setup.client) return;
    setError("");
    try {
      const { error } = await setup.client.auth.signOut();
      if (error) throw error;
      setSession(null);
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  };
  return (
    <AuthContext.Provider
      value={{
        client: setup.client,
        session,
        loading,
        error,
        configured: !!setup.client,
        signIn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="login-panel" role="status">
        Restoring your session…
      </main>
    );
  if (!auth.session)
    return (
      <main className="login-panel card">
        <p className="eyebrow">STUDENT WORKSPACE</p>
        <h1>Make room for what matters.</h1>
        <p>Sign in to organize your courses and deadlines.</p>
        {auth.error && <p role="alert">{auth.error}</p>}
        {auth.configured ? (
          <button onClick={auth.signIn}>Continue with Google</button>
        ) : (
          <p>
            Authentication is not configured. See
            docs/phase-3-frontend-integration.md.
          </p>
        )}
      </main>
    );
  return <>{children}</>;
}
