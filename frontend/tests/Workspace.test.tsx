import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../src/App'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function navigate(path: string) {
  act(() => {
    window.history.replaceState(null, '', `#${path}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

test('calendar filters tasks by date and switches months', async () => {
  render(<App />)
  await screen.findByText('API connected')
  navigate('/calendar')
  expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
  expect(screen.getByText('Practice integration techniques')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '2026-10-26, 1 tasks' }))
  expect(screen.getByText('Review sorting algorithms')).toBeInTheDocument()
  expect(screen.queryByText('Practice integration techniques')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
  expect(screen.getByText('No tasks scheduled here.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
})

test('section detail contains only its own tasks and navigation marks active page', async () => {
  render(<App />)
  await screen.findByText('API connected')
  navigate('/sections')
  expect(screen.getByRole('link', { name: 'Sections' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Mathematics' })).toHaveAttribute('href', '#/sections/mathematics')
  navigate('/sections/mathematics')
  expect(screen.getByRole('heading', { name: 'Mathematics' })).toBeInTheDocument()
  expect(screen.getByText('Practice integration techniques')).toBeInTheDocument()
  expect(screen.queryByText('Review sorting algorithms')).not.toBeInTheDocument()
  navigate('/')
  expect(screen.getByRole('heading', { name: 'Your semester, organized.' })).toBeInTheDocument()
})

test('direct section links and unknown routes have safe states', async () => {
  navigate('/sections/computer-science')
  render(<App />)
  await screen.findByText('API connected')
  expect(screen.getByRole('heading', { name: 'Computer Science' })).toBeInTheDocument()
  navigate('/sections/missing')
  expect(screen.getByRole('heading', { name: 'Section not found' })).toBeInTheDocument()
  navigate('/missing')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
