import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  acceptOrder,
  addOrderItem,
  addOrderItemService,
  cancelOrder,
  createOrder,
  issueOrderItems,
  removeOrderItem,
  removeOrderItemService,
  updateOrder,
  updateOrderItemWorkStatus,
} from '../services/orders.js'
import { orderKey } from '../queries/orders.js'

function invalidateOrder(queryClient, orderId) {
  queryClient.invalidateQueries({ queryKey: orderKey(orderId) })
  queryClient.invalidateQueries({ queryKey: ['orders'] })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useAddOrderItem(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => addOrderItem(orderId, payload),
    onSuccess: () => invalidateOrder(queryClient, orderId),
  })
}

export function useUpdateOrder(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => updateOrder(orderId, payload),
    onSuccess: () => invalidateOrder(queryClient, orderId),
  })
}

export function useAcceptOrder(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => acceptOrder(orderId),
    onSuccess: () => invalidateOrder(queryClient, orderId),
  })
}

export function useRemoveOrderItem(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId) => removeOrderItem(itemId),
    onSuccess: () => invalidateOrder(queryClient, orderId),
  })
}

export function useCancelOrder(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cancelOrder(orderId, 'Отменено из рабочего места приёмки'),
    onSuccess: () => invalidateOrder(queryClient, orderId),
  })
}

export function useIssueOrderItems(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemIds, reason }) => issueOrderItems(orderId, { itemIds, reason }),
    onSuccess: () => {
      invalidateOrder(queryClient, orderId)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export function useUpdateOrderItemWorkStatus(orderId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, status }) => updateOrderItemWorkStatus(itemId, status),
    onSuccess: () => {
      invalidateOrder(queryClient, orderId)
      queryClient.invalidateQueries({ queryKey: ['production-items'] })
    },
  })
}

export function useAddOrderItemService(itemId, options = {}) {
  return useMutation({
    mutationFn: (payload) => addOrderItemService(itemId, payload),
    ...options,
  })
}

export function useRemoveOrderItemService(itemId, serviceId, options = {}) {
  return useMutation({
    mutationFn: () => removeOrderItemService(itemId, serviceId),
    ...options,
  })
}
