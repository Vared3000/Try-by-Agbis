import { apiClient } from '../api/client.js'

export async function listPriceLists() {
  return (await apiClient.get('/price-lists')).data.data
}

export async function getPriceList(id) {
  return (await apiClient.get(`/price-lists/${id}`)).data.data
}

export async function createPriceList(payload) {
  return (await apiClient.post('/price-lists', payload)).data.data
}

export async function updatePriceList(id, payload) {
  return (await apiClient.patch(`/price-lists/${id}`, payload)).data.data
}

export async function archivePriceList(id) {
  await apiClient.delete(`/price-lists/${id}`)
}

export async function addPriceListItem(id, payload) {
  return (await apiClient.post(`/price-lists/${id}/items`, payload)).data.data
}

export async function updatePriceListItem(id, itemId, payload) {
  return (await apiClient.patch(`/price-lists/${id}/items/${itemId}`, payload)).data.data
}

export async function removePriceListItem(id, itemId) {
  await apiClient.delete(`/price-lists/${id}/items/${itemId}`)
}
