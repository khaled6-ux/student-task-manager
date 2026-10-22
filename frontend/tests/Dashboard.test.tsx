import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../src/App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('renders dashboard empty states and successful API connection', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Your semester, organized.' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  expect(screen.getByText('Your assignments and deadlines will appear here.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Your courses' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API connected'))
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})

test.each([
  ['network failure', () => Promise.reject(new Error('offline'))],
  ['HTTP failure', () => Promise.resolve({ ok: false })],
  ['unhealthy response', () => Promise.resolve({ ok: true, json: async () => ({ status: 'error' }) })],
])('shows offline state on %s', async (_name, response) => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(response))
  render(<App />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API offline'))
})
