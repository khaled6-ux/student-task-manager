import { formatCalendarDate, weekdays } from "../../i18n/format";
import { useI18n } from "../../i18n/useI18n";
import { useState } from "react";
import { TaskList } from "../../components/TaskList";
import { tasks } from "../tasks/mockData";

export function Calendar() {
  const { t, locale, taskCount } = useI18n();
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState("2026-10-23");
  const label = month.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const shiftMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`,
    );
  };
  return (
    <>
      <section className="intro">
        <p className="eyebrow">{t("PLAN YOUR PACE")}</p>
        <h1>{t("Calendar")}</h1>
        <p>{t("Select a date to explore its mock assignments.")}</p>
      </section>
      <section className="card">
        <div className="section-heading">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label={t("Previous month")}
          >
            {locale === "ar" ? "→" : "←"}
          </button>
          <h2 aria-live="polite">{label}</h2>
          <button onClick={() => shiftMonth(1)} aria-label={t("Next month")}>
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
            {Array.from({ length: month.getDay() }, (_, index) => (
              <div aria-hidden="true" key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
              const count = tasks.filter(
                (task) => task.dueDate === date,
              ).length;
              return (
                <button
                  className="calendar-day"
                  key={date}
                  aria-label={`${new Intl.DateTimeFormat(locale, { dateStyle: "full", calendar: "gregory" }).format(new Date(`${date}T12:00:00`))}, ${taskCount(count)}`}
                  aria-pressed={selectedDate === date}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{new Intl.NumberFormat(locale).format(index + 1)}</span>
                  {count > 0 && <small>{taskCount(count)}</small>}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="card agenda">
        <h2>
          {t("Tasks for {date}", {
            date: formatCalendarDate(locale, selectedDate),
          })}
        </h2>
        <TaskList
          tasks={tasks.filter((task) => task.dueDate === selectedDate)}
        />
      </section>
    </>
  );
}
