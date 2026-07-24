import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { PriceListsPage } from '../pages/PriceListsPage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('PriceListsPage', () => {
  beforeEach(() => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/price-lists') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'price-list-1',
                name: 'Основной прайс',
                validFrom: '2026-01-01',
                validTo: null,
                status: 'active',
              },
            ],
          },
        })
      }
      if (url === '/price-lists/price-list-1') {
        return Promise.resolve({
          data: {
            data: {
              id: 'price-list-1',
              name: 'Основной прайс',
              status: 'active',
              items: [
                {
                  id: 'price-item-1',
                  price: '59000',
                  service: { id: 'service-1', name: 'Чистка' },
                  garmentType: { id: 'garment-1', name: 'Ковер' },
                },
              ],
            },
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    apiClient.patch.mockResolvedValue({ data: { data: { price: '65000' } } })
  })

  it('edits an existing price', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <PriceListsPage />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
    fireEvent.change(screen.getByLabelText('Цена для Чистка'), {
      target: { value: '650' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/price-lists/price-list-1/items/price-item-1',
        { price: '65000' },
      ),
    )
  })
})
