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
          <span className="brand-icon">S</span> Student Workspace
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[
            ["Dashboard", "/"],
            ["Calendar", "/calendar"],
            ["Courses", "/courses"],
            ["Sections", "/sections"],
            ["Profile", "/profile"],
          ].map(([name, href]) => (
            <a
              key={href}
              href={`#${href}`}
              className={page === name ? "active" : ""}
              aria-current={page === name ? "page" : undefined}
            >
              {name}
            </a>
          ))}
          {categories.map((name) => (
            <a
              key={name}
              href={`#/sections/${name}`}
              aria-current={category === name ? "page" : undefined}
            >
              {name[0].toUpperCase() + name.slice(1)}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          A little progress, every day.
          <small>Your coursework is private to your account.</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            {profile?.display_name ?? "My workspace"} / {page}
          </span>
          <div className="actions">
            <button disabled={busy || loading} onClick={() => void reload()}>
              Refresh data
            </button>
            <button onClick={logout}>Log out</button>
          </div>
        </header>
        {busy && <p role="status">Saving changes…</p>}
        {notice && <p role="status">{notice}</p>}
        {authError && <p role="alert">{authError}</p>}
        {error && (
          <div role="alert" className="error-box">
            {error}
            <button disabled={busy || loading} onClick={() => void reload()}>
              Retry loading
            </button>
          </div>
        )}
        {loading && profile && <p role="status">Refreshing workspace…</p>}
        {loading && !profile ? (
          <p role="status">Loading workspace…</p>
        ) : !profile ? (
          <p>Workspace data is unavailable. Retry loading to continue.</p>
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
                  <h1>Section not found</h1>
                  <a href="#/sections">All sections</a>
                </section>
              ) : (
                <>
                  <section className="intro">
                    <h1>
                      {category
                        ? category[0].toUpperCase() + category.slice(1)
                        : "Sections"}
                    </h1>
                    <p>Tasks organized by category.</p>
                  </section>
                  {!category && (
                    <div className="category-links">
                      {categories.map((value) => (
                        <a key={value} href={`#/sections/${value}`}>
                          {value[0].toUpperCase() + value.slice(1)} ·{" "}
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
                <h1>Page not found</h1>
                <a href="#/">Back to dashboard</a>
              </section>
            )}
          </>
        )}
        <footer>
          <span>Student Task Manager</span>
          <span>{profile?.timezone ?? "Authenticated workspace"}</span>
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
