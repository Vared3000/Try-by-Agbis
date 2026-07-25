import { useQuery } from '@tanstack/react-query'

import { getOrder, listOrders } from '../services/orders.js'

export const ordersKey = (search = '', status = '') => ['orders', search, status]
export const orderKey = (id) => ['order', id]

export function useOrders(search = '', status = '', options = {}) {
  return useQuery({
    queryKey: ordersKey(search, status),
    queryFn: () => listOrders({ search, status }),
    ...options,
  })
}

export function useOrder(id, options = {}) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: () => getOrder(id),
    enabled: Boolean(id),
    ...options,
  })
}
