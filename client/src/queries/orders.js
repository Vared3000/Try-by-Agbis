import { useQuery } from '@tanstack/react-query'

import { getOrder, listOrders } from '../services/orders.js'

export const ordersKey = (search = '', status = '') => ['orders', search, status]
export const orderKey = (id) => ['order', id]

// Orders/payments are edited concurrently from multiple physical workstations
// (reception, cash desk, production) — short polling keeps the list and the
// open order's status/paidAmount from drifting stale between them, since we
// have no websocket/event push yet. See HANDOFF.md Critical #2.
const ORDERS_LIST_POLL_MS = 10_000
const ORDER_DETAIL_POLL_MS = 5_000

export function useOrders(search = '', status = '', options = {}) {
  return useQuery({
    queryKey: ordersKey(search, status),
    queryFn: () => listOrders({ search, status }),
    refetchInterval: ORDERS_LIST_POLL_MS,
    ...options,
  })
}

export function useOrder(id, options = {}) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: () => getOrder(id),
    enabled: Boolean(id),
    refetchInterval: ORDER_DETAIL_POLL_MS,
    ...options,
  })
}
