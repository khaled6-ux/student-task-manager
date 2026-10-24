import type { Mutation } from "./dataContext";
import { DataContext } from "./dataContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiClient, ApiError } from "../lib/client";
import { useAuth } from "../features/auth/authContext";
import type { Course, Profile, Task } from "../types/api";

export function DataProvider({ children }: { children: ReactNode }) {
  const { client, session } = useAuth();
  const ownerId = session!.user.id;
  const api = useMemo(
    () =>
      new ApiClient(async () => {
        const result = await client!.auth.getSession();
        if (result.error || result.data.session?.user.id !== ownerId)
          return null;
        return result.data.session?.access_token ?? null;
      }),
    [client, ownerId],
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
  const writing = useRef(false);
  const requiresRefresh = useRef(false);
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const reload = useCallback(
    async (initial = false) => {
      if (writing.current) return;
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
        if (!controller.signal.aborted) {
          requiresRefresh.current = false;
          setData({ profile, courses, tasks });
        }
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
    active.current = true;
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void reload(true);
    });
    return () => {
      mounted = false;
      active.current = false;
      pending.current?.abort();
    };
  }, [reload]);
  const mutate = async (mutation: Mutation) => {
    // Synchronous guard also covers two submits before React can render disabled buttons.
    if (requiresRefresh.current)
      throw new Error("Refresh workspace before making further changes.");
    if (writing.current) throw new Error("A change is already being saved.");
    writing.current = true;
    pending.current?.abort(); // An older full read must not overwrite a confirmed write.
    setLoading(false);
    setBusy(true);
    setNotice("");
    setError("");
    try {
      switch (mutation.kind) {
        case "profile-save": {
          const profile = await mutation.write();
          if (active.current) setData((current) => ({ ...current, profile }));
          break;
        }
        case "course-save": {
          const course = await mutation.write();
          if (active.current)
            setData((current) => ({
              ...current,
              courses: upsert(current.courses, course),
            }));
          break;
        }
        case "task-save": {
          const task = await mutation.write();
          if (active.current)
            setData((current) => ({
              ...current,
              tasks: upsert(current.tasks, task),
            }));
          break;
        }
        case "task-delete": {
          await mutation.write();
          if (active.current)
            setData((current) => ({
              ...current,
              tasks: current.tasks.filter((task) => task.id !== mutation.id),
            }));
          break;
        }
        case "course-delete": {
          await mutation.write();
          if (!active.current) return;
          setData((current) => ({
            ...current,
            courses: current.courses.filter(
              (course) => course.id !== mutation.id,
            ),
          }));
          // DELETE returns no task rows. Reload only affected data to retain server timestamps.
          if (data.tasks.some((task) => task.course_id === mutation.id)) {
            try {
              const tasks = await api.tasks();
              if (active.current) setData((current) => ({ ...current, tasks }));
            } catch {
              requiresRefresh.current = true;
              if (active.current)
                setError(
                  "Course deleted, but linked tasks could not be refreshed. Retry loading before making further changes.",
                );
            }
          }
          break;
        }
      }
      if (active.current) setNotice("Changes saved.");
    } catch (error) {
      if (error instanceof ApiError && error.uncertain) {
        requiresRefresh.current = true;
        if (active.current) setError(error.message);
      }
      throw error;
    } finally {
      writing.current = false;
      if (active.current) setBusy(false);
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

function upsert<T extends { id: string; created_at: string }>(
  items: T[],
  item: T,
): T[] {
  return [...items.filter((current) => current.id !== item.id), item].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      a.id.localeCompare(b.id),
  );
}
