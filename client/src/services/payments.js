import { apiClient } from '../api/client.js'

export async function getCurrentCashShift(branchId) {
  return (
    await apiClient.get('/cash-shifts/current', { params: { branchId } })
  ).data.data
}

export async function openCashShift(payload) {
  return (await apiClient.post('/cash-shifts', payload)).data.data
}

export async function createOrderPayment(orderId, payload) {
  return (
    await apiClient.post(`/orders/${orderId}/payments`, payload, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
  ).data.data
}
