import { apiClient } from '../api/client.js'

export async function updateOrderItemMeasurements(itemId, payload) {
  return (
    await apiClient.patch(`/order-items/${itemId}/measurements`, payload)
  ).data.data
}
