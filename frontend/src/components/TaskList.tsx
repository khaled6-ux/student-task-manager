import type { Task } from '../types/workspace'

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className="muted">No tasks scheduled here.</p>
  return <ul className="task-list">{tasks.map(task => (
    <li key={task.id}><div><strong>{task.title}</strong><small>Due <time dateTime={task.dueDate}>{task.dueDate}</time></small></div><span className="badge">{task.status}</span></li>
  ))}</ul>
}
