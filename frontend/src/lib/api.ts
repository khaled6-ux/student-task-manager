const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function checkHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${apiUrl}/health`, { signal })
  if (!response.ok || (await response.json()).status !== 'ok') {
    throw new Error('API unavailable')
  }
}
