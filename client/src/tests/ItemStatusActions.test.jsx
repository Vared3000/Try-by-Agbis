import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ItemStatusActions } from '../features/orders/ItemStatusActions.jsx'

describe('order item status actions', () => {
  afterEach(cleanup)

  it('moves an accepted item into work or completed status', () => {
    const onSetStatus = vi.fn()
    render(
      <ItemStatusActions
        item={{ status: 'accepted' }}
        onIssue={vi.fn()}
        onSetStatus={onSetStatus}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'В работе' }))
    fireEvent.click(screen.getByRole('button', { name: 'Исполнен' }))

    expect(onSetStatus).toHaveBeenNthCalledWith(1, 'in_progress')
    expect(onSetStatus).toHaveBeenNthCalledWith(2, 'ready')
    expect(screen.getByRole('button', { name: 'Выдать изделие' })).toBeDisabled()
  })

  it('allows a completed item to be issued', () => {
    const onIssue = vi.fn()
    render(
      <ItemStatusActions
        item={{ status: 'ready' }}
        onIssue={onIssue}
        onSetStatus={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Выдать изделие' }))

    expect(onIssue).toHaveBeenCalledOnce()
  })
})
