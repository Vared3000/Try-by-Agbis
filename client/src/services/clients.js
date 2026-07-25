import { apiClient } from '../api/client.js'

export async function listClients({ search, pageSize = 100 } = {}) {
  return (
    await apiClient.get('/clients', {
      params: { search: search || undefined, pageSize },
    })
  ).data.data
}

export async function getClient(id) {
  return (await apiClient.get(`/clients/${id}`)).data.data
}

export async function getClientOrders(id) {
  return (await apiClient.get(`/clients/${id}/orders`)).data.data
}

export async function createClient(payload) {
  return (await apiClient.post('/clients', payload)).data.data
}

export async function updateClient(id, payload) {
  return (await apiClient.patch(`/clients/${id}`, payload)).data.data
}

export async function addClientAddress(id, payload) {
  return (await apiClient.post(`/clients/${id}/addresses`, payload)).data.data
}
