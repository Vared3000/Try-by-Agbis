import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SaveOrderButton } from '../features/orders/SaveOrderButton.jsx'

describe('save order button', () => {
  it('confirms that the order was synchronized', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<SaveOrderButton changeToken={1} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заказ' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Заказ сохранён ✓' })).toBeInTheDocument()

    rerender(<SaveOrderButton changeToken={2} onSave={onSave} />)
    expect(screen.getByRole('button', { name: 'Сохранить заказ' })).toBeInTheDocument()
  })
})
