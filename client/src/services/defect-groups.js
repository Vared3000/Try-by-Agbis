import { apiClient } from '../api/client.js'

export async function listDefectGroups() {
  return (await apiClient.get('/defect-groups')).data.data
}

export async function createDefectGroup(payload) {
  return (await apiClient.post('/defect-groups', payload)).data.data
}

export async function updateDefectGroup(id, payload) {
  return (await apiClient.patch(`/defect-groups/${id}`, payload)).data.data
}

export async function archiveDefectGroup(id) {
  await apiClient.delete(`/defect-groups/${id}`)
}
