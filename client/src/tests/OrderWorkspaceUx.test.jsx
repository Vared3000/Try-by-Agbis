import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrderListPanel } from '../features/orders/OrderListPanel.jsx'
import { useOrderHotkeys } from '../features/orders/useOrderHotkeys.js'

describe('order workspace UX', () => {
  it('exposes accessible order rows, SLA and quick status filters', () => {
    const onOpenOrder = vi.fn()
    const onStatusChange = vi.fn()
    render(
      <OrderListPanel
        orders={[
          {
            id: 'order-1',
            displayNumber: 'AG-0001',
            status: 'ready',
            totalAmount: '354000',
            createdAt: '2026-07-20T10:00:00.000Z',
            dueAt: '2020-07-21T10:00:00.000Z',
            isOverdue: true,
            client: { fullName: 'Иван Петров', phone: '+79990000000' },
          },
        ]}
        loading={false}
        search=""
        status=""
        selectedOrderId=""
        onSearchChange={vi.fn()}
        onStatusChange={onStatusChange}
        onOpenOrder={onOpenOrder}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /AG-0001.*Иван Петров/s }))
    expect(onOpenOrder).toHaveBeenCalledWith('order-1')
    expect(screen.getByText('Просрочен')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Готовы' }))
    expect(onStatusChange).toHaveBeenCalledWith('ready')
  })

  it('supports the primary reception hotkeys', () => {
    const actions = {
      onNewOrder: vi.fn(),
      onAddItem: vi.fn(),
      onAcceptOrder: vi.fn(),
      onPrintReceipt: vi.fn(),
    }

    function Harness() {
      useOrderHotkeys({
        ...actions,
        canAddItem: true,
        canAcceptOrder: true,
        canPrintReceipt: true,
      })
      return <input aria-label="Редактируемое поле" />
    }

    render(<Harness />)
    fireEvent.keyDown(window, { key: 'F2' })
    fireEvent.keyDown(window, { key: 'F4' })
    fireEvent.keyDown(window, { key: 'F8' })
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    expect(actions.onNewOrder).toHaveBeenCalledOnce()
    expect(actions.onAddItem).toHaveBeenCalledOnce()
    expect(actions.onPrintReceipt).toHaveBeenCalledOnce()
    expect(actions.onAcceptOrder).toHaveBeenCalledOnce()

    fireEvent.keyDown(screen.getByLabelText('Редактируемое поле'), { key: 'F2' })
    fireEvent.keyDown(screen.getByLabelText('Редактируемое поле'), {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(actions.onNewOrder).toHaveBeenCalledOnce()
    expect(actions.onAcceptOrder).toHaveBeenCalledOnce()
  })
})
