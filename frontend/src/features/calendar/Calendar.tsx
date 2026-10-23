import { useState } from 'react'
import { TaskList } from '../../components/TaskList'
import { tasks } from '../tasks/mockData'

export function Calendar() {
  const [month, setMonth] = useState(new Date(2026, 9, 1))
  const [selectedDate, setSelectedDate] = useState('2026-10-23')
  const label = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const shiftMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`)
  }
  return <>
    <section className="intro"><p className="eyebrow">PLAN YOUR PACE</p><h1>Calendar</h1><p>Select a date to explore its mock assignments.</p></section>
    <section className="card"><div className="section-heading"><button onClick={() => shiftMonth(-1)} aria-label="Previous month">←</button><h2 aria-live="polite">{label}</h2><button onClick={() => shiftMonth(1)} aria-label="Next month">→</button></div>
      <div className="calendar-scroll"><div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="weekday" key={day}>{day}</div>)}
        {Array.from({ length: month.getDay() }, (_, index) => <div aria-hidden="true" key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
          const count = tasks.filter(task => task.dueDate === date).length
          return <button className="calendar-day" key={date} aria-label={`${date}, ${count} tasks`} aria-pressed={selectedDate === date} onClick={() => setSelectedDate(date)}><span>{index + 1}</span>{count > 0 && <small>{count} task</small>}</button>
        })}
      </div></div>
    </section>
    <section className="card agenda"><h2>Tasks for {selectedDate}</h2><TaskList tasks={tasks.filter(task => task.dueDate === selectedDate)} /></section>
  </>
}
