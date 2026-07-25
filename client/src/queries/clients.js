import { useQuery } from '@tanstack/react-query'

import { getClient, getClientOrders, listClients } from '../services/clients.js'

export const clientsKey = (search = '') => ['clients', search]
export const clientKey = (id) => ['client', id]
export const clientOrdersKey = (id) => ['client-orders', id]
export const clientSearchKey = (search) => ['client-picker', search]

export function useClients(search = '', options = {}) {
  return useQuery({
    queryKey: clientsKey(search),
    queryFn: () => listClients({ search }),
    ...options,
  })
}

export function useClient(id, options = {}) {
  return useQuery({
    queryKey: clientKey(id),
    queryFn: () => getClient(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useClientOrders(id, options = {}) {
  return useQuery({
    queryKey: clientOrdersKey(id),
    queryFn: () => getClientOrders(id),
    enabled: Boolean(id),
    ...options,
  })
}

// The picker searches a smaller page size and only once the query is long
// enough, so it is cached separately from the full client directory.
export function useClientSearch(search, options = {}) {
  return useQuery({
    queryKey: clientSearchKey(search),
    queryFn: () => listClients({ search, pageSize: 50 }),
    enabled: search.length >= 2,
    ...options,
  })
}
