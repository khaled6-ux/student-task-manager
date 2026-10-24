import { formatCalendarDate, weekdays } from "../../i18n/format";
import { useI18n } from "../../i18n/useI18n";
import { useState } from "react";
import { useData } from "../../app/dataContext";
import { dayKey } from "../../lib/dates";
import { TaskManager } from "../tasks/TaskManager";

export function LiveCalendar() {
  const { t, locale, number, taskCount } = useI18n();
  const { tasks, profile } = useData();
  const timeZone = profile?.timezone ?? "UTC";
  const [today] = useState(() => dayKey(new Date().toISOString(), timeZone));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(
    () => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
  );
  const monthLabel = month.toLocaleDateString(locale, {
    calendar: "gregory",
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
        <h1>{t("Calendar")}</h1>
        <p>{t("Deadlines shown in {zone}.", { zone: timeZone })}</p>
      </section>
      <section className="card">
        <div className="section-heading">
          <button onClick={() => shift(-1)} aria-label={t("Previous month")}>
            {locale === "ar" ? "→" : "←"}
          </button>
          <h2 aria-live="polite">{monthLabel}</h2>
          <button onClick={() => shift(1)} aria-label={t("Next month")}>
            {locale === "ar" ? "←" : "→"}
          </button>
        </div>
        <div className="calendar-scroll">
          <div className="calendar-grid">
            {weekdays(locale).map((label, index) => (
              <div className="weekday" key={index}>
                {label}
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
                    aria-label={`${formatCalendarDate(locale, date, "full")}, ${taskCount(count)}`}
                    aria-pressed={selected === date}
                    onClick={() => setSelected(date)}
                  >
                    {number(i + 1)}
                    {count > 0 && <small>{taskCount(count)}</small>}
                  </button>
                );
              },
            )}
          </div>
        </div>
      </section>
      <section className="card agenda">
        <h2>
          {t("Tasks for {date}", {
            date: formatCalendarDate(locale, selected),
          })}
        </h2>
        <TaskManager
          tasks={dated.filter(
            (task) => dayKey(task.due_at!, timeZone) === selected,
          )}
        />
      </section>
    </>
  );
}
