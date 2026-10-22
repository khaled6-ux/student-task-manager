import { useEffect, useState } from 'react'
import { checkHealth } from '../../lib/api'

export function Dashboard() {
  const [health, setHealth] = useState('Checking connection…')
  useEffect(() => {
    const controller = new AbortController()
    checkHealth(controller.signal)
      .then(() => setHealth('API connected'))
      .catch(() => { if (!controller.signal.aborted) setHealth('API offline — start the backend') })
    return () => controller.abort()
  }, [])

  return (
    <div className="layout">
      <aside className="sidebar">
        <a className="brand" href="#overview"><span className="brand-icon">S</span> Student Workspace</a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation"><a className="active" href="#overview" aria-current="page">Overview</a><a href="#tasks">My tasks</a><a href="#courses">Courses</a></nav>
        <div className="sidebar-note">A little progress, every day.<small>Your space to plan what comes next.</small></div>
      </aside>
      <main id="overview">
        <header><span>My workspace / Overview</span><span className="avatar" aria-label="Student workspace">ST</span></header>
        <section className="intro"><p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h1>Your semester, organized.</h1><p>Keep your coursework in view and take the next step with clarity.</p></section>
        <section className="stats" aria-label="Task summary">
          {[['Total tasks', '0', 'A fresh start'], ['In progress', '0', 'One step at a time'], ['Completed', '0', 'Every win counts']].map(([label, value, note]) => <article className="card" key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
        </section>
        <div className="content-grid">
          <section className="card" id="tasks"><div className="section-heading"><h2>My tasks</h2><span className="badge">Getting started</span></div><div className="empty"><span className="empty-icon" aria-hidden="true">✓</span><h3>A clear space to focus</h3><p>Your assignments and deadlines will appear here.</p><small>Task creation is coming in a future phase.</small></div></section>
          <section className="card" id="courses"><h2>Your courses</h2><div className="empty"><span className="empty-icon" aria-hidden="true">▤</span><h3>Build your semester</h3><p>Organize your work by course.</p><small>Course management is coming soon.</small></div></section>
        </div>
        <footer><span>Student Task Manager · Foundation preview</span><span role="status">{health}</span></footer>
      </main>
    </div>
  )
}
