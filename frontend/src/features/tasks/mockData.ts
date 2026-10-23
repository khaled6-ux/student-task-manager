import type { Section, Task } from '../../types/workspace'

export const sections: Section[] = [
  { id: 'mathematics', name: 'Mathematics', code: 'MATH 201', description: 'Problem solving, calculus, and weekly practice.' },
  { id: 'computer-science', name: 'Computer Science', code: 'CS 101', description: 'Algorithms, programming, and practical projects.' },
  { id: 'writing', name: 'Academic Writing', code: 'ENG 110', description: 'Research, clear arguments, and thoughtful revision.' },
]
export const tasks: Task[] = [
  { id: 't1', sectionId: 'mathematics', title: 'Practice integration techniques', dueDate: '2026-10-23', status: 'In progress' },
  { id: 't2', sectionId: 'computer-science', title: 'Review sorting algorithms', dueDate: '2026-10-26', status: 'To do' },
  { id: 't3', sectionId: 'writing', title: 'Outline research essay', dueDate: '2026-10-28', status: 'To do' },
  { id: 't4', sectionId: 'mathematics', title: 'Submit weekly exercises', dueDate: '2026-10-20', status: 'Done' },
]
