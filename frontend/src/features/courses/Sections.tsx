import { useI18n } from "../../i18n/useI18n";
import { TaskList } from "../../components/TaskList";
import { sections, tasks } from "../tasks/mockData";

export function Sections({ sectionId }: { sectionId?: string }) {
  const { t } = useI18n();
  const selected = sections.find((section) => section.id === sectionId);
  if (sectionId && !selected)
    return (
      <section className="intro">
        <h1>{t("Section not found")}</h1>
        <a href="#/sections">{t("Back to sections")}</a>
      </section>
    );
  return (
    <>
      <section className="intro">
        <p className="eyebrow">{t("YOUR STUDY SPACE")}</p>
        <h1>{selected?.name ?? t("Sections")}</h1>
        <p>
          {selected?.description ??
            t("Explore your courses and the work ahead.")}
        </p>
      </section>
      {selected ? (
        <section className="card">
          <h2>
            {selected.code}
            {t("tasks")}
          </h2>
          <TaskList
            tasks={tasks.filter((task) => task.sectionId === selected.id)}
          />
        </section>
      ) : (
        <div className="section-cards">
          {sections.map((section) => (
            <article className="card" key={section.id}>
              <span className="badge">{section.code}</span>
              <h2>
                <a href={`#/sections/${section.id}`}>{section.name}</a>
              </h2>
              <p>{section.description}</p>
              <small>
                {tasks.filter((task) => task.sectionId === section.id).length}
                {t("mock tasks")}
              </small>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
