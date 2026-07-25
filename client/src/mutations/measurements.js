import { useMutation } from '@tanstack/react-query'

import { updateOrderItemMeasurements } from '../services/measurements.js'

export function useUpdateOrderItemMeasurements(itemId, options = {}) {
  return useMutation({
    mutationFn: (payload) => updateOrderItemMeasurements(itemId, payload),
    ...options,
  })
}
