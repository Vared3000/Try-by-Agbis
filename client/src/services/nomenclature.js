import { apiClient } from '../api/client.js'

export async function listNomenclature(search = '') {
  return (
    await apiClient.get('/nomenclature', {
      params: search ? { search } : {},
    })
  ).data.data
}

export async function createNomenclatureItem(payload) {
  return (await apiClient.post('/nomenclature', payload)).data.data
}

export async function updateNomenclatureItem(id, payload) {
  return (await apiClient.patch(`/nomenclature/${id}`, payload)).data.data
}

export async function archiveNomenclatureItem(id) {
  await apiClient.delete(`/nomenclature/${id}`)
}
