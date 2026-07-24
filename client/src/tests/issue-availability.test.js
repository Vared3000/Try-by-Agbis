import { describe, expect, it } from 'vitest'

import {
  canIssueWholeOrder,
  remainingOrderItems,
} from '../features/orders/issue-availability.js'

describe('order issue availability', () => {
  it('allows issuing the whole order when every remaining item is ready', () => {
    const items = [
      { id: 'issued', status: 'issued' },
      { id: 'ready-1', status: 'ready' },
      { id: 'ready-2', status: 'ready' },
    ]

    expect(remainingOrderItems(items).map((item) => item.id)).toEqual([
      'ready-1',
      'ready-2',
    ])
    expect(canIssueWholeOrder(items)).toBe(true)
  })

  it('blocks whole-order issue while at least one item is not ready', () => {
    expect(
      canIssueWholeOrder([
        { id: 'ready', status: 'ready' },
        { id: 'cleaning', status: 'cleaning' },
      ]),
    ).toBe(false)
  })
})
