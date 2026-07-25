import { apiClient } from '../api/client.js'

export async function getOperationalReport() {
  return (await apiClient.get('/reports/operational')).data.data
}

export async function getFinancialReport() {
  return (await apiClient.get('/reports/financial')).data.data
}
