import { LanguageSelector } from "../i18n/LanguageSelector";
import { useI18n } from "../i18n/useI18n";
import { useEffect, useState } from "react";
import { checkHealth } from "../lib/api";
import { Dashboard } from "../features/tasks/Dashboard";
import { Calendar } from "../features/calendar/Calendar";
import { Sections } from "../features/courses/Sections";

export function Workspace() {
  const { t, message } = useI18n();
  const [path, setPath] = useState(window.location.hash.slice(1) || "/");
  const [health, setHealth] = useState("Checking connection…");
  useEffect(() => {
    const navigate = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal)
      .then(() => setHealth("API connected"))
      .catch(() => {
        if (!controller.signal.aborted)
          setHealth("API offline — start the backend");
      });
    return () => controller.abort();
  }, []);
  const sectionId = path.startsWith("/sections/")
    ? path.slice("/sections/".length)
    : undefined;
  const page =
    path === "/"
      ? "Dashboard"
      : path === "/calendar"
        ? "Calendar"
        : path === "/sections" || sectionId
          ? "Sections"
          : "Not found";
  return (
    <div className="layout">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <span className="brand-icon">S</span>
          {t("Student Workspace")}
        </a>
        <p className="nav-label">{t("WORKSPACE")}</p>
        <nav aria-label={t("Main navigation")}>
          {(
            [
              ["Dashboard", "/"],
              ["Calendar", "/calendar"],
              ["Sections", "/sections"],
            ] as const
          ).map(([name, href]) => (
            <a
              key={href}
              href={`#${href}`}
              className={page === name ? "active" : undefined}
              aria-current={page === name ? "page" : undefined}
            >
              {t(name)}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          {t("A little progress, every day.")}
          <small>{t("Your space to plan what comes next.")}</small>
        </div>
      </aside>
      <main>
        <header>
          <LanguageSelector />
          <span>
            {t("My workspace")} / {t(page)}
          </span>
          <span className="avatar" aria-label={t("Student workspace")}>
            ST
          </span>
        </header>
        <p className="preview-notice">
          {t("Mock data preview · Changes are not saved.")}
        </p>
        {page === "Dashboard" ? (
          <Dashboard />
        ) : page === "Calendar" ? (
          <Calendar />
        ) : page === "Sections" ? (
          <Sections key={path} sectionId={sectionId} />
        ) : (
          <section className="intro">
            <h1>{t("Page not found")}</h1>
            <a href="#/">{t("Back to dashboard")}</a>
          </section>
        )}
        <footer>
          <span>{t("Student Task Manager · Mock workspace")}</span>
          <span role="status">{message(health)}</span>
        </footer>
      </main>
    </div>
  );
}
