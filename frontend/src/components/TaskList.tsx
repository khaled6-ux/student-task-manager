import { useI18n } from "../i18n/useI18n";
import type { Task } from "../types/workspace";

export function TaskList({ tasks }: { tasks: Task[] }) {
  const { t, date } = useI18n();
  if (!tasks.length)
    return <p className="muted">{t("No tasks scheduled here.")}</p>;
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <small>
              {t("Due")}{" "}
              <time dateTime={task.dueDate}>
                {date(`${task.dueDate}T12:00:00Z`, "UTC", {
                  dateStyle: "medium",
                })}
              </time>
            </small>
          </div>
          <span className="badge">{t(task.status)}</span>
        </li>
      ))}
    </ul>
  );
}
