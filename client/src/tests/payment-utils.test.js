import { describe, expect, it } from 'vitest'

import {
  findReceptionWorkplace,
  kopecksToRubles,
  rublesToKopecks,
} from '../features/orders/payment-utils.js'

describe('order payment utilities', () => {
  it('converts rubles and kopecks without floating-point rounding', () => {
    expect(kopecksToRubles('59099')).toBe('590.99')
    expect(rublesToKopecks('590,99')).toBe('59099')
    expect(rublesToKopecks('590.9')).toBe('59090')
  })

  it('selects the reception workplace used for the order', () => {
    const workplace = findReceptionWorkplace(
      [
        {
          id: 'branch-1',
          locations: [
            {
              id: 'location-1',
              type: 'acceptance',
              workplaces: [{ id: 'desk-1', type: 'reception' }],
            },
          ],
        },
      ],
      { branchId: 'branch-1', acceptanceLocationId: 'location-1' },
    )

    expect(workplace.id).toBe('desk-1')
  })
})
