import { apiClient } from '../api/client.js'

export async function listOrders({ search, status, pageSize = 100 } = {}) {
  const rows = (
    await apiClient.get('/orders', {
      params: {
        pageSize,
        search: search || undefined,
        status: status || undefined,
      },
    })
  ).data.data
  const loadedAt = Date.now()
  const finalStatuses = new Set(['issued', 'cancelled'])
  return rows.map((row) => ({
    ...row,
    isOverdue:
      Boolean(row.dueAt) &&
      !finalStatuses.has(row.status) &&
      new Date(row.dueAt).getTime() < loadedAt,
  }))
}

export async function getOrder(id) {
  return (await apiClient.get(`/orders/${id}`)).data.data
}

export async function createOrder(payload) {
  return (await apiClient.post('/orders', payload)).data.data
}

export async function updateOrder(id, payload) {
  return (await apiClient.patch(`/orders/${id}`, payload)).data.data
}

export async function acceptOrder(id) {
  return (
    await apiClient.post(
      `/orders/${id}/accept`,
      {},
      { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    )
  ).data.data
}

export async function cancelOrder(id, reason) {
  return (await apiClient.post(`/orders/${id}/cancel`, { reason })).data.data
}

export async function issueOrderItems(id, { itemIds, reason }) {
  return (
    await apiClient.post(
      `/orders/${id}/issues`,
      { itemIds, paymentOverrideReason: reason || null },
      { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    )
  ).data.data
}

export async function addOrderItem(orderId, payload) {
  return (await apiClient.post(`/orders/${orderId}/items`, payload)).data.data
}

export async function removeOrderItem(itemId) {
  await apiClient.delete(`/orders/items/${itemId}`)
}

export async function updateOrderItemWorkStatus(itemId, status) {
  return (
    await apiClient.patch(`/order-items/${itemId}/work-status`, { status })
  ).data.data
}

export async function addOrderItemService(itemId, payload) {
  return (await apiClient.post(`/orders/items/${itemId}/services`, payload)).data.data
}

export async function removeOrderItemService(itemId, serviceId) {
  await apiClient.delete(`/orders/items/${itemId}/services/${serviceId}`)
}
