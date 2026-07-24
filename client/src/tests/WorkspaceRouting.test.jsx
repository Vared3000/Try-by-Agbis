import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { AuthContext } from '../app/auth-context.js'
import { WorkspacePage } from '../pages/WorkspacePage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const response = (data) => Promise.resolve({ data: { data } })

describe('Workspace routing', () => {
  it('opens an order from a direct URL and navigates between sections', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/orders/order-1') {
        return response({
          id: 'order-1',
          displayNumber: 'AG-0001',
          status: 'accepted',
          totalAmount: '0',
          paidAmount: '0',
          client: { fullName: 'Иван Петров' },
          items: [],
        })
      }
      if (url === '/auth/context') return response({ branches: [] })
      return response([])
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              displayName: 'Администратор',
              roleCodes: ['owner'],
            },
            signOut: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/orders/order-1?status=ready']}>
            <WorkspacePage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Заказы' })).toBeVisible()
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/orders/order-1'))

    fireEvent.click(screen.getByRole('button', { name: /Клиенты/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Клиенты' }),
    ).toBeVisible()
  })

  it('preselects a client when a new order is opened from the client card', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/clients/client-1') {
        return response({
          id: 'client-1',
          fullName: 'Анна Смирнова',
          phone: '+79990000000',
        })
      }
      if (url === '/auth/context') {
        return response({
          branches: [
            {
              id: 'branch-1',
              name: 'Филиал',
              locations: [{ id: 'location-1', name: 'Приёмка' }],
            },
          ],
        })
      }
      return response([])
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              displayName: 'Администратор',
              roleCodes: ['owner'],
            },
            signOut: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/orders?clientId=client-1']}>
            <WorkspacePage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Анна Смирнова')).toBeVisible()
    expect(screen.getByText('+79990000000')).toBeVisible()
  })
})
