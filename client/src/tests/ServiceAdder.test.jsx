import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { ServiceAdder } from '../features/orders/OrderItemControls.jsx'
import { availableServicePrices } from '../features/orders/service-options.js'

vi.mock('../api/client.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

const genericPrice = {
  id: 'price-generic',
  serviceId: 'service-stain',
  garmentTypeId: null,
  price: '90000',
  service: {
    id: 'service-stain',
    name: 'Удаление пятен',
    unit: 'item',
    category: { name: 'Дополнительная обработка' },
  },
}

describe('ServiceAdder', () => {
  it('offers generic service prices for a nomenclature item and adds a snapshot', async () => {
    apiClient.post.mockResolvedValue({ data: { data: { id: 'line-1' } } })
    const onChanged = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ServiceAdder
          item={{
            id: 'item-1',
            nomenclatureItemId: 'nomenclature-1',
            garmentTypeId: null,
            services: [],
          }}
          prices={[genericPrice]}
          onChanged={onChanged}
        />
      </QueryClientProvider>,
    )

    const combobox = screen.getByRole('combobox', {
      name: 'Дополнительная услуга',
    })
    fireEvent.focus(combobox)
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Удаление пятен/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить услугу' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/orders/items/item-1/services', {
        serviceId: 'service-stain',
        quantity: '1',
      }),
    )
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('prefers an exact garment price and hides services already added', () => {
    const exactPrice = {
      ...genericPrice,
      id: 'price-exact',
      garmentTypeId: 'garment-1',
      price: '120000',
    }
    expect(
      availableServicePrices(
        {
          garmentTypeId: 'garment-1',
          services: [],
        },
        [genericPrice, exactPrice],
      ),
    ).toEqual([exactPrice])

    expect(
      availableServicePrices(
        {
          garmentTypeId: 'garment-1',
          services: [{ serviceId: 'service-stain' }],
        },
        [genericPrice, exactPrice],
      ),
    ).toEqual([])
  })
})
