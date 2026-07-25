import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addTransferItem,
  createTransfer,
  receiveTransfer,
  removeTransferItem,
  sendTransfer,
} from '../services/transfers.js'
import { transfersKey } from '../queries/transfers.js'

function invalidateTransfers(queryClient) {
  return queryClient.invalidateQueries({ queryKey: transfersKey })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createTransfer(payload),
    onSuccess: () => invalidateTransfers(queryClient),
  })
}

export function useAddTransferItem(id, { onSuccess, ...options } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scanCode) => addTransferItem(id, scanCode),
    onSuccess: (...args) => {
      invalidateTransfers(queryClient)
      onSuccess?.(...args)
    },
    ...options,
  })
}

export function useRemoveTransferItem(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId) => removeTransferItem(id, itemId),
    onSuccess: () => invalidateTransfers(queryClient),
  })
}

export function useSendTransfer(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => sendTransfer(id),
    onSuccess: () => invalidateTransfers(queryClient),
  })
}

export function useReceiveTransfer(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (receivedItemIds) => receiveTransfer(id, receivedItemIds),
    onSuccess: () => invalidateTransfers(queryClient),
  })
}
