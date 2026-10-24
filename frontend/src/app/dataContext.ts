import { createContext, useContext } from "react";
import type { ApiClient } from "../lib/client";
import type { Course, Profile, Task } from "../types/api";

export interface WorkspaceData {
  profile: Profile | null;
  courses: Course[];
  tasks: Task[];
}
export type Mutation =
  | { kind: "profile-save"; write: () => Promise<Profile> }
  | { kind: "course-save"; write: () => Promise<Course> }
  | { kind: "task-save"; write: () => Promise<Task> }
  | { kind: "course-delete"; id: string; write: () => Promise<void> }
  | { kind: "task-delete"; id: string; write: () => Promise<void> };

export interface DataState extends WorkspaceData {
  profile: Profile | null;
  courses: Course[];
  tasks: Task[];
  loading: boolean;
  busy: boolean;
  notice: string;
  error: string;
  reload: () => Promise<void>;
  mutate: (mutation: Mutation) => Promise<void>;
  api: ApiClient;
}
export const DataContext = createContext<DataState | null>(null);
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("DataProvider is required");
  return context;
}
