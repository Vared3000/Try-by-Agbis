import { apiClient } from '../api/client.js'

export async function getAuthContext() {
  return (await apiClient.get('/auth/context')).data.data
}
