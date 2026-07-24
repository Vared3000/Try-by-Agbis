import { describe, expect, it } from 'vitest'

import { orderDisplayNumber } from '../modules/orders/order-number.js'

describe('order display number', () => {
  it('combines a six-digit order sequence with the branch number', () => {
    expect(orderDisplayNumber({ branchNumber: 1, sequence: '1' })).toBe('000001-1')
    expect(orderDisplayNumber({ branchNumber: 12, sequence: '47' })).toBe(
      '000047-12',
    )
  })
})
