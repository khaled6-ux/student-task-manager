export type TaskStatus = 'To do' | 'In progress' | 'Done'
export interface Section { id: string; name: string; code: string; description: string }
export interface Task { id: string; sectionId: string; title: string; dueDate: string; status: TaskStatus }
