import { createContext, useContext } from "react";
import type { ApiClient } from "../lib/client";
import type { Course, Profile, Task } from "../types/api";

export interface DataState {
  profile: Profile | null;
  courses: Course[];
  tasks: Task[];
  loading: boolean;
  busy: boolean;
  notice: string;
  error: string;
  reload: () => Promise<void>;
  mutate: (write: () => Promise<unknown>) => Promise<void>;
  api: ApiClient;
}
export const DataContext = createContext<DataState | null>(null);
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("DataProvider is required");
  return context;
}
