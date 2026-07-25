import { apiClient } from '../api/client.js'

export async function listServices() {
  return (await apiClient.get('/services')).data.data
}

export async function createService(payload) {
  return (await apiClient.post('/services', payload)).data.data
}

export async function updateService(id, payload) {
  return (await apiClient.patch(`/services/${id}`, payload)).data.data
}

export async function archiveService(id) {
  await apiClient.delete(`/services/${id}`)
}
