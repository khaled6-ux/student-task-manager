import { DataContext } from "./dataContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiClient } from "../lib/client";
import { useAuth } from "../features/auth/authContext";
import type { Course, Profile, Task } from "../types/api";

export function DataProvider({ children }: { children: ReactNode }) {
  const { client } = useAuth();
  const api = useMemo(
    () =>
      new ApiClient(async () => {
        const result = await client!.auth.getSession();
        if (result.error) return null;
        return result.data.session?.access_token ?? null;
      }),
    [client],
  );
  const [data, setData] = useState<{
    profile: Profile | null;
    courses: Course[];
    tasks: Task[];
  }>({ profile: null, courses: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const reload = useCallback(
    async (initial = false) => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      if (!initial) {
        setLoading(true);
        setError("");
      }
      try {
        const [profile, courses, tasks] = await Promise.all([
          api.profile(controller.signal),
          api.courses(controller.signal),
          api.tasks(controller.signal),
        ]);
        if (!controller.signal.aborted) setData({ profile, courses, tasks });
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load workspace.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    // Defer bootstrap so StrictMode cleanup can cancel before issuing requests.
    let active = true;
    queueMicrotask(() => {
      if (active) void reload(true);
    });
    return () => {
      active = false;
      pending.current?.abort();
    };
  }, [reload]);
  const mutate = async (write: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await write();
      setNotice("Changes saved.");
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <DataContext.Provider
      value={{ ...data, loading, busy, notice, error, reload, mutate, api }}
    >
      {children}
    </DataContext.Provider>
  );
}
