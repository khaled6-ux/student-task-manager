export const categories = [
  "homeworks",
  "exams",
  "finals",
  "projects",
  "presentations",
] as const;
export type Category = (typeof categories)[number];
export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";
export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
}
export interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}
export interface Task {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  category: Category;
  priority: Priority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type CourseInput = Pick<Course, "name" | "code" | "color">;
export type TaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "status"
  | "category"
  | "priority"
  | "course_id"
  | "due_at"
>;
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
