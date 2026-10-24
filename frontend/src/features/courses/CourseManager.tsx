import { useState } from "react";
import type { FormEvent } from "react";
import { useData } from "../../app/dataContext";
import type { Course, CourseInput } from "../../types/api";
import { TaskManager } from "../tasks/TaskManager";

export function CourseManager({ courseId }: { courseId?: string }) {
  const { courses, tasks, api, mutate, busy } = useData();
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const selected = courses.find((course) => course.id === courseId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const body: CourseInput = {
      name: String(form.get("name")).trim(),
      code: String(form.get("code")).trim() || null,
      color: String(form.get("color")),
    };
    if (!body.name) {
      setError("Enter a course name.");
      return;
    }
    try {
      await mutate({
        kind: "course-save",
        write: () =>
          editing === "new"
            ? api.createCourse(body)
            : api.updateCourse((editing as Course).id, body),
      });
      setEditing(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save course.",
      );
    }
  };
  const remove = async () => {
    setError("");
    try {
      await mutate({
        kind: "course-delete",
        id: deleting!.id,
        write: () => api.deleteCourse(deleting!.id),
      });
      setDeleting(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to delete course.",
      );
    }
  };
  if (courseId)
    return (
      <>
        <section className="intro">
          <h1>{selected?.name ?? "Course not found"}</h1>
          <a href="#/courses">All courses</a>
        </section>
        {selected && (
          <section className="card">
            <TaskManager
              tasks={tasks.filter((task) => task.course_id === selected.id)}
            />
          </section>
        )}
      </>
    );
  return (
    <>
      <section className="intro">
        <h1>Courses</h1>
        <p>Organize tasks by course.</p>
      </section>
      <button
        disabled={busy}
        onClick={() => {
          setError("");
          setEditing("new");
        }}
      >
        New course
      </button>
      {error && <p role="alert">{error}</p>}
      {editing && (
        <form
          className="editor card"
          key={editing === "new" ? "new" : editing.id}
          aria-label={editing === "new" ? "Create course" : "Edit course"}
          onSubmit={submit}
        >
          <h2>{editing === "new" ? "New course" : "Edit course"}</h2>
          <label>
            Name
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={editing === "new" ? "" : editing.name}
              autoFocus
            />
          </label>
          <label>
            Code
            <input
              name="code"
              maxLength={30}
              defaultValue={editing === "new" ? "" : (editing.code ?? "")}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              name="color"
              defaultValue={editing === "new" ? "#226b55" : editing.color}
            />
          </label>
          <div className="actions">
            <button disabled={busy} type="submit">
              {busy ? "Saving…" : "Save course"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {deleting && (
        <div
          className="confirm-box"
          role="dialog"
          aria-label="Confirm course deletion"
        >
          <p>
            Delete “{deleting.name}”? Its tasks will be retained without a
            course.
          </p>
          <button disabled={busy} onClick={remove}>
            {busy ? "Deleting…" : "Confirm delete course"}
          </button>
          <button disabled={busy} onClick={() => setDeleting(null)}>
            Cancel deletion
          </button>
        </div>
      )}
      {!courses.length && (
        <p className="muted">No courses yet. Create your first course.</p>
      )}
      <div className="section-cards">
        {courses.map((course) => (
          <article
            className="card"
            key={course.id}
            style={{ borderTop: `4px solid ${course.color}` }}
          >
            <h2>
              <a href={`#/courses/${course.id}`}>{course.name}</a>
            </h2>
            <p>{course.code}</p>
            <small>
              {tasks.filter((task) => task.course_id === course.id).length}{" "}
              tasks
            </small>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  setError("");
                  setEditing(course);
                }}
              >
                Edit {course.name}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setError("");
                  setDeleting(course);
                }}
              >
                Delete {course.name}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
