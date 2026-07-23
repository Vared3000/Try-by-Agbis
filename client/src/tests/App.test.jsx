import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { App } from '../app/App.jsx'

vi.mock('../api/client.js', () => ({
  refreshSession: vi.fn().mockRejectedValue(new Error('No session')),
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  setAccessToken: vi.fn(),
  apiClient: { get: vi.fn() },
}))

describe('App', () => {
  it('renders the login screen when there is no refresh session', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'С возвращением' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
  })
})
