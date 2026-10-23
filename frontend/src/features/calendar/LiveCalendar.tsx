import { useState } from "react";
import { useData } from "../../app/dataContext";
import { dayKey } from "../../lib/dates";
import { TaskManager } from "../tasks/TaskManager";

export function LiveCalendar() {
  const { tasks, profile } = useData();
  const timeZone = profile?.timezone ?? "UTC";
  const [today] = useState(() => dayKey(new Date().toISOString(), timeZone));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(
    () => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
  );
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const dated = tasks.filter((task) => task.due_at);
  const key = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const shift = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`,
    );
  };
  return (
    <>
      <section className="intro">
        <h1>Calendar</h1>
        <p>Deadlines shown in {timeZone}.</p>
      </section>
      <section className="card">
        <div className="section-heading">
          <button onClick={() => shift(-1)} aria-label="Previous month">
            ←
          </button>
          <h2 aria-live="polite">{monthLabel}</h2>
          <button onClick={() => shift(1)} aria-label="Next month">
            →
          </button>
        </div>
        <div className="calendar-scroll">
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div className="weekday" key={day}>
                {day}
              </div>
            ))}
            {Array.from({ length: month.getDay() }, (_, i) => (
              <div key={`blank-${i}`} aria-hidden="true" />
            ))}
            {Array.from(
              {
                length: new Date(
                  month.getFullYear(),
                  month.getMonth() + 1,
                  0,
                ).getDate(),
              },
              (_, i) => {
                const date = key(i + 1);
                const count = dated.filter(
                  (task) => dayKey(task.due_at!, timeZone) === date,
                ).length;
                return (
                  <button
                    key={date}
                    className="calendar-day"
                    aria-label={`${date}, ${count} tasks`}
                    aria-pressed={selected === date}
                    onClick={() => setSelected(date)}
                  >
                    {i + 1}
                    {count > 0 && (
                      <small>
                        {count} task{count > 1 ? "s" : ""}
                      </small>
                    )}
                  </button>
                );
              },
            )}
          </div>
        </div>
      </section>
      <section className="card agenda">
        <h2>Tasks for {selected}</h2>
        <TaskManager
          tasks={dated.filter(
            (task) => dayKey(task.due_at!, timeZone) === selected,
          )}
        />
      </section>
    </>
  );
}
