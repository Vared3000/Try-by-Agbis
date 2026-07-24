import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { MeasurementEditor } from '../features/orders/OrderItemControls.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}))

describe('deferred order item measurement', () => {
  it('allows a square-meter item to be measured later', async () => {
    apiClient.patch.mockResolvedValue({ data: { data: {} } })
    const onChanged = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MeasurementEditor
          item={{
            id: 'item-1',
            length: null,
            width: null,
            area: null,
            quantity: null,
            nomenclature: { unit: 'square_meter' },
          }}
          onChanged={onChanged}
        />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText('Длина, м'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Ширина, м'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить замер' }))

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith('/order-items/item-1/measurements', {
        length: '2',
        width: '3',
      }),
    )
    expect(onChanged).toHaveBeenCalledOnce()
  })
})
