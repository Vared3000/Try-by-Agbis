import { apiClient } from '../api/client.js'

export async function listCatalog(path) {
  return (await apiClient.get(`/catalog/${path}`)).data.data
}

export async function createCatalogEntry(path, payload) {
  return (await apiClient.post(`/catalog/${path}`, payload)).data.data
}

export async function updateCatalogEntry(path, id, payload) {
  return (await apiClient.patch(`/catalog/${path}/${id}`, payload)).data.data
}

export async function archiveCatalogEntry(path, id) {
  await apiClient.delete(`/catalog/${path}/${id}`)
}
