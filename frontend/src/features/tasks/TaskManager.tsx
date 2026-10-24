import { useI18n } from "../../i18n/useI18n";
import type { Mutation } from "../../app/dataContext";
import { useState } from "react";
import type { FormEvent } from "react";
import { useData } from "../../app/dataContext";
import { categories } from "../../types/api";
import type {
  Category,
  Priority,
  Status,
  Task,
  TaskInput,
} from "../../types/api";
import { instantFromLocal, localInput } from "../../lib/dates";

function TaskForm({
  task,
  category,
  close,
}: {
  task?: Task;
  category?: Category;
  close: () => void;
}) {
  const { t, message } = useI18n();
  const { api, mutate, courses, busy } = useData();
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim();
    if (!title) {
      setError("Enter a task title.");
      return;
    }
    if (!event.currentTarget.checkValidity()) {
      setError("Please check the form values and deadline timezone.");
      return;
    }
    try {
      const local = String(form.get("due_at"));
      const body: TaskInput = {
        title,
        description: String(form.get("description")).trim() || null,
        status: form.get("status") as Status,
        priority: form.get("priority") as Priority,
        category: form.get("category") as Category,
        course_id: String(form.get("course_id")) || null,
        due_at:
          task && local === localInput(task.due_at)
            ? task.due_at
            : instantFromLocal(local),
      };
      await mutate({
        kind: "task-save",
        write: () =>
          task ? api.updateTask(task.id, body) : api.createTask(body),
      });
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save task.");
    }
  };
  return (
    <form
      noValidate
      className="editor card"
      onSubmit={submit}
      aria-label={task ? t("Edit task") : t("Create task")}
    >
      <h2>{task ? t("Edit task") : t("New task")}</h2>
      {error && <p role="alert">{message(error)}</p>}
      <label>
        {t("Title")}
        <input
          name="title"
          dir="auto"
          defaultValue={task?.title}
          required
          maxLength={200}
          autoFocus
        />
      </label>
      <label>
        {t("Description")}
        <textarea
          name="description"
          dir="auto"
          defaultValue={task?.description ?? ""}
          maxLength={10000}
        />
      </label>
      <div className="form-grid">
        <label>
          {t("Category")}
          <select
            name="category"
            defaultValue={task?.category ?? category ?? "homeworks"}
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Course")}
          <select name="course_id" defaultValue={task?.course_id ?? ""}>
            <option value="">{t("No course")}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Status")}
          <select name="status" defaultValue={task?.status ?? "todo"}>
            <option value="todo">{t("To do")}</option>
            <option value="in_progress">{t("In progress")}</option>
            <option value="done">{t("Done")}</option>
          </select>
        </label>
        <label>
          {t("Priority")}
          <select name="priority" defaultValue={task?.priority ?? "medium"}>
            {(["low", "medium", "high"] as const).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t("Deadline ({zone}; your browser timezone)", {
          zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })}
        <input
          name="due_at"
          type="datetime-local"
          defaultValue={localInput(task?.due_at ?? null)}
        />
      </label>
      <div className="actions">
        <button disabled={busy} type="submit">
          {busy ? t("Saving…") : t("Save task")}
        </button>
        <button type="button" disabled={busy} onClick={close}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}

export function TaskManager({
  tasks,
  category,
}: {
  tasks: Task[];
  category?: Category;
}) {
  const { t, message, date } = useI18n();
  const { api, mutate, busy, profile, courses } = useData();
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const run = async (mutation: Mutation) => {
    setError("");
    try {
      await mutate(mutation);
      setDeleting(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to update task.",
      );
    }
  };
  return (
    <>
      <div className="section-heading">
        <h2>{t("Tasks")}</h2>
        <button disabled={busy} onClick={() => setEditing("new")}>
          {t("New task")}
        </button>
      </div>
      {error && <p role="alert">{message(error)}</p>}
      {editing && (
        <TaskForm
          key={editing === "new" ? "new" : editing.id}
          task={editing === "new" ? undefined : editing}
          category={category}
          close={() => setEditing(null)}
        />
      )}
      {deleting && (
        <div
          className="confirm-box"
          role="dialog"
          aria-modal="false"
          aria-label={t("Confirm task deletion")}
        >
          <p>
            {t("Delete “{name}”? This cannot be undone.", {
              name: deleting.title,
            })}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run({
                kind: "task-delete",
                id: deleting.id,
                write: () => api.deleteTask(deleting.id),
              })
            }
          >
            {t("Confirm delete")}
          </button>
          <button disabled={busy} onClick={() => setDeleting(null)}>
            {t("Cancel deletion")}
          </button>
        </div>
      )}
      {!tasks.length && <p className="muted">{t("No tasks here yet.")}</p>}
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <small>
                {t(task.category)} · {t(task.priority)} · {t(task.status)} ·{" "}
                {courses.find((course) => course.id === task.course_id)?.name ??
                  t("No course")}
              </small>
              {task.description && <p>{task.description}</p>}
              <small>
                {task.due_at ? (
                  <time dateTime={task.due_at}>
                    {date(task.due_at, profile?.timezone ?? "UTC")}
                  </time>
                ) : (
                  t("No deadline")
                )}
              </small>
            </div>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  run({
                    kind: "task-save",
                    write: () =>
                      api.updateTask(task.id, {
                        status: task.status === "done" ? "todo" : "done",
                      }),
                  })
                }
              >
                {task.status === "done" ? t("Reopen") : t("Complete")}{" "}
                {task.title}
              </button>
              <button disabled={busy} onClick={() => setEditing(task)}>
                {t("Edit")} {task.title}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setError("");
                  setDeleting(task);
                }}
              >
                {t("Delete")} {task.title}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
