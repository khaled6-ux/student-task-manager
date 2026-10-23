import { TaskList } from '../../components/TaskList'
import { sections, tasks } from '../tasks/mockData'

export function Sections({ sectionId }: { sectionId?: string }) {
  const selected = sections.find(section => section.id === sectionId)
  if (sectionId && !selected) return <section className="intro"><h1>Section not found</h1><a href="#/sections">Back to sections</a></section>
  return <>
    <section className="intro"><p className="eyebrow">YOUR STUDY SPACE</p><h1>{selected?.name ?? 'Sections'}</h1><p>{selected?.description ?? 'Explore your courses and the work ahead.'}</p></section>
    {selected ? <section className="card"><h2>{selected.code} tasks</h2><TaskList tasks={tasks.filter(task => task.sectionId === selected.id)} /></section>
      : <div className="section-cards">{sections.map(section => <article className="card" key={section.id}><span className="badge">{section.code}</span><h2><a href={`#/sections/${section.id}`}>{section.name}</a></h2><p>{section.description}</p><small>{tasks.filter(task => task.sectionId === section.id).length} mock tasks</small></article>)}</div>}
  </>
}
