import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { ProductionPage } from '../pages/ProductionPage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const queueItem = {
  id: 'item-1',
  scanCode: 'CF-ITEM-1',
  routeId: 'route-1',
  status: 'accepted',
  nomenclature: { name: 'Ковер шерстяной' },
  order: {
    displayNumber: 'AG-0001',
    dueAt: '2099-07-30T12:00:00.000Z',
    client: { fullName: 'Иван Петров', phone: '+79990000000' },
  },
  stageHistory: [],
}

describe('ProductionPage', () => {
  beforeEach(() => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/production/routes') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'route-1',
                stages: [
                  {
                    id: 'route-stage-1',
                    stageId: 'stage-1',
                    stage: { name: 'Чистка' },
                  },
                ],
              },
            ],
          },
        })
      }
      if (url === '/production/items') {
        return Promise.resolve({
          data: { data: [queueItem], meta: { total: 1 } },
        })
      }
      if (url === '/production/items/scan/CF-ITEM-1') {
        return Promise.resolve({ data: { data: queueItem } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
  })

  it('shows the queue and opens an item without manual scanning', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ProductionPage />
      </QueryClientProvider>,
    )

    const position = await screen.findByRole('button', {
      name: /Ковер шерстяной.*AG-0001.*Иван Петров/s,
    })
    fireEvent.click(position)

    expect(await screen.findByRole('heading', { name: 'Ковер шерстяной' })).toBeVisible()
    expect(screen.getByText('Заказ AG-0001')).toBeVisible()
    expect(apiClient.get).toHaveBeenCalledWith('/production/items/scan/CF-ITEM-1')
  })
})
