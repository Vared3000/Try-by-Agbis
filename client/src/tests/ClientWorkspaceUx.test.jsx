import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { ClientsPage } from '../pages/ClientsPage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const response = (data) => Promise.resolve({ data: { data } })

function LocationProbe() {
  const location = useLocation()
  return <div>{`${location.pathname}${location.search}`}</div>
}

describe('client workspace UX', () => {
  it('shows order history and starts a new order with the selected client', async () => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/clients/client-1') {
        return response({
          id: 'client-1',
          fullName: 'Анна Смирнова',
          phone: '+79990000000',
          createdAt: '2026-07-20T10:00:00.000Z',
          addresses: [],
        })
      }
      if (url === '/clients/client-1/orders') {
        return response([
          {
            id: 'order-1',
            displayNumber: '000001-1',
            status: 'ready',
            totalAmount: '250000',
            createdAt: '2026-07-24T10:00:00.000Z',
            dueAt: '2026-07-25T10:00:00.000Z',
            items: [{ id: 'item-1' }],
          },
        ])
      }
      if (url === '/clients') {
        return response([
          {
            id: 'client-1',
            fullName: 'Анна Смирнова',
            phone: '+79990000000',
          },
        ])
      }
      return response([])
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/clients/client-1']}>
          <Routes>
            <Route path="/clients/:id" element={<ClientsPage />} />
            <Route path="/orders" element={<LocationProbe />} />
            <Route path="/orders/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('000001-1')).toBeVisible()
    expect(screen.getByText('1 поз.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '+ Новый заказ этому клиенту' }))
    expect(screen.getByText('/orders?clientId=client-1')).toBeVisible()
  })
})
