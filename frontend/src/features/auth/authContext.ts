import { createContext, useContext } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export interface AuthState {
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  error: string;
  configured: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
