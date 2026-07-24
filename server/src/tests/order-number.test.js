import { describe, expect, it } from 'vitest'

import { orderDisplayNumber } from '../modules/orders/order-number.js'

describe('order display number', () => {
  it('includes the business date so daily sequences cannot collide', () => {
    const firstDay = orderDisplayNumber({
      locationCode: 'RECEPTION',
      businessDate: '2026-07-23',
      sequence: '1',
    })
    const nextDay = orderDisplayNumber({
      locationCode: 'RECEPTION',
      businessDate: '2026-07-24',
      sequence: '1',
    })

    expect(firstDay).toBe('RECEPTION-20260723-1-1')
    expect(nextDay).toBe('RECEPTION-20260724-1-1')
    expect(nextDay).not.toBe(firstDay)
  })
})
