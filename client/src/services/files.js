import { apiClient } from '../api/client.js'

export async function uploadFile(orderItemId, file) {
  const formData = new FormData()
  formData.append('orderItemId', orderItemId)
  formData.append('file', file)
  return (await apiClient.post('/files', formData)).data.data
}

export async function deleteFile(fileId) {
  await apiClient.delete(`/files/${fileId}`)
}

export async function getFileBlob(fileId) {
  return (await apiClient.get(`/files/${fileId}`, { responseType: 'blob' })).data
}
