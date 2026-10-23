import { TaskList } from '../../components/TaskList'
import { sections, tasks } from './mockData'

export function Dashboard() {
  return <>
    <section className="intro"><p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h1>Your semester, organized.</h1><p>Keep your coursework in view and take the next step with clarity.</p></section>
    <section className="stats" aria-label="Task summary">
      {[
        ['Total tasks', tasks.length, 'Across all sections'],
        ['In progress', tasks.filter(task => task.status === 'In progress').length, 'One step at a time'],
        ['Completed', tasks.filter(task => task.status === 'Done').length, 'Every win counts'],
      ].map(([label, value, note]) => <article className="card" key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
    </section>
    <div className="content-grid">
      <section className="card"><h2>My tasks</h2><TaskList tasks={tasks} /></section>
      <section className="card"><h2>Your courses</h2><ul className="section-list">{sections.map(section => <li key={section.id}><a href={`#/sections/${section.id}`}><strong>{section.name}</strong><small>{section.code}</small></a></li>)}</ul></section>
    </div>
  </>
}
