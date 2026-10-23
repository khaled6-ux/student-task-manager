import { useEffect, useState } from "react";
import { useData } from "../../app/dataContext";
import { TaskManager } from "./TaskManager";

export function LiveDashboard() {
  const { tasks, courses, profile } = useData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = tasks
    .filter(
      (task) =>
        task.status !== "done" &&
        task.due_at &&
        new Date(task.due_at).getTime() >= now,
    )
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, 5);
  return (
    <>
      <section className="intro">
        <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
        <h1>Your semester, organized.</h1>
        <p>Your coursework and deadlines, together.</p>
      </section>
      <section className="stats" aria-label="Task summary">
        {[
          ["Total tasks", tasks.length],
          [
            "Completed tasks",
            tasks.filter((task) => task.status === "done").length,
          ],
          [
            "Pending tasks",
            tasks.filter((task) => task.status !== "done").length,
          ],
        ].map(([label, count]) => (
          <article className="card" key={label}>
            <p>{label}</p>
            <strong>{count}</strong>
          </article>
        ))}
      </section>
      <div className="content-grid">
        <section className="card">
          <h2>Upcoming deadlines</h2>
          {upcoming.length ? (
            <ul className="section-list">
              {upcoming.map((task) => (
                <li key={task.id}>
                  <a href={`#/sections/${task.category}`}>{task.title}</a>
                  <small>
                    <time dateTime={task.due_at!}>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: profile?.timezone ?? "UTC",
                      }).format(new Date(task.due_at!))}
                    </time>
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No upcoming deadlines.</p>
          )}
        </section>
        <section className="card">
          <h2>Tasks by course</h2>
          <ul className="section-list">
            {courses.map((course) => (
              <li key={course.id}>
                <a href={`#/courses/${course.id}`}>
                  {course.name} ·{" "}
                  {tasks.filter((task) => task.course_id === course.id).length}{" "}
                  tasks
                </a>
              </li>
            ))}
            <li>
              No course · {tasks.filter((task) => !task.course_id).length} tasks
            </li>
          </ul>
        </section>
      </div>
      <section className="card agenda">
        <TaskManager tasks={tasks} />
      </section>
    </>
  );
}
