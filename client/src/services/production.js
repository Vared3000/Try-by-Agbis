import { apiClient } from '../api/client.js'

export async function listProductionRoutes() {
  return (await apiClient.get('/production/routes')).data.data
}

// Returns the full response envelope (not just data.data) because the
// production queue also needs meta.total for the count display.
export async function listProductionItems({ search, status } = {}) {
  return (
    await apiClient.get('/production/items', {
      params: {
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      },
    })
  ).data
}

export async function scanProductionItem(code) {
  return (
    await apiClient.get(`/production/items/scan/${encodeURIComponent(code)}`)
  ).data.data
}

export async function transitionProductionItem(itemId, payload) {
  return (await apiClient.post(`/order-items/${itemId}/transition`, payload)).data.data
}
