import { useEffect, useState } from 'react'
import { checkHealth } from '../lib/api'
import { Dashboard } from '../features/tasks/Dashboard'
import { Calendar } from '../features/calendar/Calendar'
import { Sections } from '../features/courses/Sections'

export function Workspace() {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/')
  const [health, setHealth] = useState('Checking connection…')
  useEffect(() => {
    const navigate = () => setPath(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    checkHealth(controller.signal).then(() => setHealth('API connected')).catch(() => {
      if (!controller.signal.aborted) setHealth('API offline — start the backend')
    })
    return () => controller.abort()
  }, [])
  const sectionId = path.startsWith('/sections/') ? path.slice('/sections/'.length) : undefined
  const page = path === '/' ? 'Dashboard' : path === '/calendar' ? 'Calendar' : path === '/sections' || sectionId ? 'Sections' : 'Not found'
  return <div className="layout">
    <aside className="sidebar"><a className="brand" href="#/"><span className="brand-icon">S</span> Student Workspace</a><p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">{[['Dashboard', '/'], ['Calendar', '/calendar'], ['Sections', '/sections']].map(([name, href]) => <a key={href} href={`#${href}`} className={page === name ? 'active' : undefined} aria-current={page === name ? 'page' : undefined}>{name}</a>)}</nav>
      <div className="sidebar-note">A little progress, every day.<small>Your space to plan what comes next.</small></div>
    </aside>
    <main><header><span>My workspace / {page}</span><span className="avatar" aria-label="Student workspace">ST</span></header>
      <p className="preview-notice">Mock data preview · Changes are not saved.</p>
      {page === 'Dashboard' ? <Dashboard /> : page === 'Calendar' ? <Calendar /> : page === 'Sections' ? <Sections key={path} sectionId={sectionId} /> : <section className="intro"><h1>Page not found</h1><a href="#/">Back to dashboard</a></section>}
      <footer><span>Student Task Manager · Mock workspace</span><span role="status">{health}</span></footer>
    </main>
  </div>
}
