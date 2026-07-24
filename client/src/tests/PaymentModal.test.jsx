import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { PaymentModal } from '../features/orders/PaymentModal.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const order = {
  id: 'order-1',
  displayNumber: '000001-1',
  branchId: 'branch-1',
  acceptanceLocationId: 'location-1',
  totalAmount: '10000',
  paidAmount: '2000',
}

const branches = [
  {
    id: 'branch-1',
    locations: [
      {
        id: 'location-1',
        type: 'acceptance',
        workplaces: [{ id: 'workplace-1', type: 'reception' }],
      },
    ],
  },
]

function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentModal
        branches={branches}
        onClose={vi.fn()}
        onPaid={vi.fn().mockResolvedValue(undefined)}
        order={order}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('order payment modal', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes a card payment for the outstanding amount', async () => {
    apiClient.post.mockResolvedValue({ data: { data: { id: 'payment-1' } } })
    const onClose = vi.fn()
    const onPaid = vi.fn().mockResolvedValue(undefined)
    renderModal({ onClose, onPaid })

    fireEvent.click(screen.getByRole('button', { name: 'Картой' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оплатить картой' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/orders/order-1/payments',
        {
          amount: '8000',
          method: 'card',
          cashShiftId: null,
        },
        { headers: { 'Idempotency-Key': expect.any(String) } },
      ),
    )
    expect(onPaid).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('opens a reception shift before the first cash payment', async () => {
    apiClient.get.mockResolvedValue({ data: { data: null } })
    apiClient.post.mockImplementation((url) =>
      Promise.resolve({
        data: {
          data: { id: url === '/cash-shifts' ? 'shift-1' : 'payment-1' },
        },
      }),
    )
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Наличные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оплатить наличными' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/cash-shifts', {
        branchId: 'branch-1',
        workplaceId: 'workplace-1',
        openingAmount: '0',
      }),
    )
    expect(apiClient.post).toHaveBeenCalledWith(
      '/orders/order-1/payments',
      expect.objectContaining({
        method: 'cash',
        cashShiftId: 'shift-1',
      }),
      expect.any(Object),
    )
  })
})
