import { apiClient } from '../api/client.js'

export async function listTransfers() {
  return (await apiClient.get('/transfers')).data.data
}

export async function getTransfer(id) {
  return (await apiClient.get(`/transfers/${id}`)).data.data
}

export async function createTransfer(payload) {
  return (await apiClient.post('/transfers', payload)).data.data
}

export async function addTransferItem(id, scanCode) {
  return (await apiClient.post(`/transfers/${id}/items`, { scanCode })).data.data
}

export async function removeTransferItem(id, itemId) {
  await apiClient.delete(`/transfers/${id}/items/${itemId}`)
}

export async function sendTransfer(id) {
  return (await apiClient.post(`/transfers/${id}/send`)).data.data
}

export async function receiveTransfer(id, receivedItemIds) {
  return (
    await apiClient.post(`/transfers/${id}/receive`, { receivedItemIds })
  ).data.data
}
