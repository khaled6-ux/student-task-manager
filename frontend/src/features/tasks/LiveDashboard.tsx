import { useI18n } from "../../i18n/useI18n";
import { useEffect, useState } from "react";
import { useData } from "../../app/dataContext";
import { TaskManager } from "./TaskManager";

export function LiveDashboard() {
  const { t, number, date, taskCount } = useI18n();
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
        <p className="eyebrow">{t("MAKE ROOM FOR WHAT MATTERS")}</p>
        <h1>{t("Your semester, organized.")}</h1>
        <p>{t("Your coursework and deadlines, together.")}</p>
      </section>
      <section className="stats" aria-label={t("Task summary")}>
        {(
          [
            ["Total tasks", tasks.length],
            [
              "Completed tasks",
              tasks.filter((task) => task.status === "done").length,
            ],
            [
              "Pending tasks",
              tasks.filter((task) => task.status !== "done").length,
            ],
          ] as const
        ).map(([label, count]) => (
          <article className="card" key={label}>
            <p>{t(label)}</p>
            <strong>{number(Number(count))}</strong>
          </article>
        ))}
      </section>
      <div className="content-grid">
        <section className="card">
          <h2>{t("Upcoming deadlines")}</h2>
          {upcoming.length ? (
            <ul className="section-list">
              {upcoming.map((task) => (
                <li key={task.id}>
                  <a href={`#/sections/${task.category}`}>{task.title}</a>
                  <small>
                    <time dateTime={task.due_at!}>
                      {date(task.due_at!, profile?.timezone ?? "UTC")}
                    </time>
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t("No upcoming deadlines.")}</p>
          )}
        </section>
        <section className="card">
          <h2>{t("Tasks by course")}</h2>
          <ul className="section-list">
            {courses.map((course) => (
              <li key={course.id}>
                <a href={`#/courses/${course.id}`}>
                  {course.name} ·{" "}
                  {taskCount(
                    tasks.filter((task) => task.course_id === course.id).length,
                  )}
                </a>
              </li>
            ))}
            <li>
              {t("No course")} ·{" "}
              {taskCount(tasks.filter((task) => !task.course_id).length)}
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
