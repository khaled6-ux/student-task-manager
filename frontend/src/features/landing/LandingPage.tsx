import { catalogs } from "../../i18n/catalog";
import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { landingEnglish } from "../../i18n/landing.en";
import { useI18n } from "../../i18n/useI18n";
import { LanguageSelector } from "../../i18n/LanguageSelector";
import type { MessageKey } from "../../i18n/catalog";
import "./landing.css";

interface LandingPageProps {
  configured: boolean;
  error: string;
  onSignIn: () => Promise<void>;
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m10 16 4 4 8-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Arrow() {
  return (
    <svg
      className="welcome-arrow"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function focusSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  target.scrollIntoView({
    behavior: reduceMotion ? "instant" : "smooth",
    block: "start",
  });
  target.focus({ preventScroll: true });
}

export function LandingPage({ configured, error, onSignIn }: LandingPageProps) {
  const { t, message: translateError } = useI18n();
  const copy = localizeLanding(landingEnglish, t);
  const [connecting, setConnecting] = useState(false);
  const pending = useRef(false);
  const [failure, setFailure] = useState("");
  const start = async () => {
    if (!configured || pending.current) return;
    pending.current = true;
    setConnecting(true);
    setFailure("");
    try {
      await onSignIn();
    } catch {
      setFailure(landingEnglish.signInFailed);
    } finally {
      pending.current = false;
      setConnecting(false);
    }
  };
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    // Preserve protected deep links and OAuth query parameters; scrolling is not routing.
    event.preventDefault();
    focusSection("welcome-main");
  };
  const disabled = !configured || connecting;
  const message = configured
    ? error || failure
      ? translateError(error || failure)
      : ""
    : copy.unavailable;
  return (
    <div className="welcome">
      <a className="welcome-skip" href="#welcome-main" onClick={skip}>
        {copy.skip}
      </a>
      <div className="welcome-frame">
        <header className="welcome-header" id="welcome-top" tabIndex={-1}>
          <span className="welcome-brand">
            <Mark />
            <span>{copy.brand}</span>
          </span>
          <nav aria-label={copy.navigation} className="welcome-nav">
            <button
              type="button"
              aria-controls="welcome-features"
              onClick={() => focusSection("welcome-features")}
            >
              {copy.featuresLink}
            </button>
            <button
              type="button"
              aria-controls="welcome-preview"
              onClick={() => focusSection("welcome-preview")}
            >
              {copy.previewLink}
            </button>
          </nav>
          <LanguageSelector />
          <button
            type="button"
            className="welcome-signin"
            onClick={start}
            disabled={disabled}
          >
            {copy.signIn}
            <Arrow />
          </button>
        </header>
        <main id="welcome-main" className="welcome-main" tabIndex={-1}>
          <section className="welcome-hero" aria-labelledby="welcome-title">
            <p className="welcome-eyebrow welcome-enter">{copy.eyebrow}</p>
            <h1 id="welcome-title" className="welcome-enter">
              {copy.headlineStart}
              <br /> <span>{copy.headlineEnd}</span>
            </h1>
            <p className="welcome-introduction welcome-enter">
              {copy.introduction}
            </p>
            <div className="welcome-hero-action welcome-enter">
              <button
                type="button"
                className="welcome-primary"
                onClick={start}
                disabled={disabled}
              >
                {copy.getStarted}
                <Arrow />
              </button>
              <p>{copy.googleNote}</p>
            </div>
            {connecting && (
              <p className="welcome-status" role="status">
                {copy.connecting}
              </p>
            )}
            {message && (
              <p className="welcome-error" role="alert">
                {message}
              </p>
            )}
          </section>
          <section
            id="welcome-preview"
            tabIndex={-1}
            className="welcome-preview-section"
            aria-label={copy.previewLabel}
          >
            <figure className="welcome-preview">
              <div className="welcome-preview-window" aria-hidden="true">
                <div className="welcome-window-bar">
                  <span className="welcome-window-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{copy.brand}</span>
                  <span className="welcome-window-symbol">
                    <Arrow />
                  </span>
                </div>
                <div className="welcome-dashboard">
                  <aside className="welcome-demo-sidebar">
                    <span className="welcome-demo-brand">
                      <Mark />
                      {copy.preview.workspace}
                    </span>
                    <div className="welcome-demo-nav">
                      <span className="is-active">{copy.preview.overview}</span>
                      <span>{copy.preview.courses}</span>
                      <span>{copy.preview.calendar}</span>
                    </div>
                    <span className="welcome-demo-sidebar-note">
                      {copy.footerNote}
                    </span>
                  </aside>
                  <div className="welcome-demo-content">
                    <p className="welcome-demo-eyebrow">
                      {copy.preview.overview}
                    </p>
                    <h2>{copy.preview.greeting}</h2>
                    <p className="welcome-demo-subtitle">
                      {copy.preview.subheading}
                    </p>
                    <div className="welcome-demo-stats">
                      {copy.preview.stats.map((stat) => (
                        <div key={stat.label}>
                          <span>{stat.label}</span>
                          <strong>{stat.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="welcome-demo-panels">
                      <div className="welcome-demo-tasks">
                        <div className="welcome-demo-panel-heading">
                          <h3>{copy.preview.taskHeading}</h3>
                          <span>{copy.preview.taskHint}</span>
                        </div>
                        {copy.preview.tasks.map((task) => (
                          <div
                            className={`welcome-demo-task ${task.complete ? "is-complete" : ""}`}
                            key={task.title}
                          >
                            <span className="welcome-demo-check">
                              {task.complete ? "✓" : ""}
                            </span>
                            <div>
                              <strong>{task.title}</strong>
                              <span>{task.course}</span>
                            </div>
                            <small>{task.due}</small>
                          </div>
                        ))}
                      </div>
                      <div className="welcome-demo-courses">
                        <h3>{copy.preview.courseHeading}</h3>
                        {copy.preview.courseItems.map((course) => (
                          <div key={course.code}>
                            <span className="welcome-course-swatch" />
                            <div>
                              <strong>{course.name}</strong>
                              <span>{course.code}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption>{copy.previewCaption}</figcaption>
            </figure>
          </section>
          <section
            id="welcome-features"
            className="welcome-features"
            tabIndex={-1}
            aria-labelledby="welcome-features-title"
          >
            <p className="welcome-eyebrow">{copy.featuresEyebrow}</p>
            <h2 id="welcome-features-title">{copy.featuresHeading}</h2>
            <p className="welcome-section-intro">{copy.featuresIntroduction}</p>
            <div className="welcome-feature-grid">
              {copy.features.map((feature) => (
                <article key={feature.number}>
                  <span className="welcome-feature-number">
                    {feature.number} /
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </section>
          <section
            className="welcome-closing"
            aria-labelledby="welcome-closing-title"
          >
            <p className="welcome-eyebrow">{copy.closingEyebrow}</p>
            <h2 id="welcome-closing-title">{copy.closingHeading}</h2>
            <p>{copy.closingBody}</p>
            <button
              type="button"
              className="welcome-primary"
              onClick={start}
              disabled={disabled}
            >
              {copy.closingAction}
              <Arrow />
            </button>
          </section>
        </main>
        <footer className="welcome-footer">
          <div>
            <span className="welcome-footer-brand">{copy.brand}</span>
            <p>{copy.footerNote}</p>
          </div>
          <button type="button" onClick={() => focusSection("welcome-top")}>
            {copy.backToTop}
            <span aria-hidden="true">↑</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

// Only authored landing copy is translated; live user content never enters this function.
function localizeLanding<T>(value: T, t: (key: MessageKey) => string): T {
  if (typeof value === "string")
    return (
      Object.hasOwn(catalogs.en, value) ? t(value as MessageKey) : value
    ) as T;
  if (Array.isArray(value))
    return value.map((item) => localizeLanding(item, t)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        localizeLanding(item, t),
      ]),
    ) as T;
  return value;
}
