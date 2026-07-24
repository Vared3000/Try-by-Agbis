import { describe, expect, it } from 'vitest'

import { effectiveLeadTimeHours, suggestDueAt } from '../modules/orders/due-date.js'

describe('automatic order due date', () => {
  it('uses working hours from Monday through Saturday', () => {
    const result = suggestDueAt({
      from: new Date(2026, 6, 25, 17, 0),
      leadTimeHours: 4,
    })

    expect(result.getDay()).toBe(1)
    expect(result.getHours()).toBe(12)
    expect(result.getMinutes()).toBe(0)
  })

  it('shortens the production norm for urgent orders', () => {
    expect(effectiveLeadTimeHours(48, 'normal')).toBe(48)
    expect(effectiveLeadTimeHours(48, 'urgent')).toBe(32)
    expect(effectiveLeadTimeHours(48, 'express')).toBe(20)
  })
})
