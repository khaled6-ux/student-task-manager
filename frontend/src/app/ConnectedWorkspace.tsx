import { LanguageSelector } from "../i18n/LanguageSelector";
import { useI18n } from "../i18n/useI18n";
import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/authContext";
import { DataProvider } from "./DataProvider";
import { useData } from "./dataContext";
import { LiveDashboard } from "../features/tasks/LiveDashboard";
import { LiveCalendar } from "../features/calendar/LiveCalendar";
import { CourseManager } from "../features/courses/CourseManager";
import { ProfileForm } from "../features/auth/ProfileForm";
import { TaskManager } from "../features/tasks/TaskManager";
import { categories } from "../types/api";
import type { Category } from "../types/api";

function Pages() {
  const { t, message } = useI18n();
  const [path, setPath] = useState(window.location.hash.slice(1) || "/");
  const { logout, error: authError } = useAuth();
  const { profile, tasks, loading, notice, error, reload, busy } = useData();
  useEffect(() => {
    const navigate = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const category = path.startsWith("/sections/")
    ? (path.slice(10) as Category)
    : undefined;
  const courseId = path.startsWith("/courses/") ? path.slice(9) : undefined;
  const page =
    path === "/"
      ? "Dashboard"
      : path === "/calendar"
        ? "Calendar"
        : path === "/courses" || courseId
          ? "Courses"
          : path === "/profile"
            ? "Profile"
            : path === "/sections" || category
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
              ["Courses", "/courses"],
              ["Sections", "/sections"],
              ["Profile", "/profile"],
            ] as const
          ).map(([name, href]) => (
            <a
              key={href}
              href={`#${href}`}
              className={page === name ? "active" : ""}
              aria-current={page === name ? "page" : undefined}
            >
              {t(name)}
            </a>
          ))}
          {categories.map((name) => (
            <a
              key={name}
              href={`#/sections/${name}`}
              aria-current={category === name ? "page" : undefined}
            >
              {t(name)}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          {t("A little progress, every day.")}
          <small>{t("Your coursework is private to your account.")}</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            {profile?.display_name ?? t("My workspace")} / {t(page)}
          </span>
          <div className="actions">
            <LanguageSelector />
            <button disabled={busy || loading} onClick={() => void reload()}>
              {t("Refresh data")}
            </button>
            <button onClick={logout}>{t("Log out")}</button>
          </div>
        </header>
        {busy && <p role="status">{t("Saving changes…")}</p>}
        {notice && <p role="status">{message(notice)}</p>}
        {authError && <p role="alert">{message(authError)}</p>}
        {error && (
          <div role="alert" className="error-box">
            {message(error)}
            <button disabled={busy || loading} onClick={() => void reload()}>
              {t("Retry loading")}
            </button>
          </div>
        )}
        {loading && profile && (
          <p role="status">{t("Refreshing workspace…")}</p>
        )}
        {loading && !profile ? (
          <p role="status">{t("Loading workspace…")}</p>
        ) : !profile ? (
          <p>
            {t("Workspace data is unavailable. Retry loading to continue.")}
          </p>
        ) : (
          <>
            {page === "Dashboard" ? (
              <LiveDashboard />
            ) : page === "Calendar" ? (
              <LiveCalendar key={profile.timezone} />
            ) : page === "Courses" ? (
              <CourseManager key={path} courseId={courseId} />
            ) : page === "Profile" ? (
              <ProfileForm />
            ) : page === "Sections" ? (
              category && !categories.includes(category) ? (
                <section className="intro">
                  <h1>{t("Section not found")}</h1>
                  <a href="#/sections">{t("All sections")}</a>
                </section>
              ) : (
                <>
                  <section className="intro">
                    <h1>{category ? t(category) : t("Sections")}</h1>
                    <p>{t("Tasks organized by category.")}</p>
                  </section>
                  {!category && (
                    <div className="category-links">
                      {categories.map((value) => (
                        <a key={value} href={`#/sections/${value}`}>
                          {t(value)} ·{" "}
                          {
                            tasks.filter((task) => task.category === value)
                              .length
                          }
                        </a>
                      ))}
                    </div>
                  )}
                  <section className="card">
                    <TaskManager
                      key={path}
                      category={category}
                      tasks={tasks.filter(
                        (task) => !category || task.category === category,
                      )}
                    />
                  </section>
                </>
              )
            ) : (
              <section className="intro">
                <h1>{t("Page not found")}</h1>
                <a href="#/">{t("Back to dashboard")}</a>
              </section>
            )}
          </>
        )}
        <footer>
          <span>{t("Student Task Manager")}</span>
          <span>{profile?.timezone ?? t("Authenticated workspace")}</span>
        </footer>
      </main>
    </div>
  );
}
export function ConnectedWorkspace() {
  const { session } = useAuth();
  return (
    <DataProvider key={session!.user.id}>
      <Pages />
    </DataProvider>
  );
}
