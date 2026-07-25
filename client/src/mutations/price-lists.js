import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addPriceListItem,
  archivePriceList,
  createPriceList,
  removePriceListItem,
  updatePriceList,
  updatePriceListItem,
} from '../services/price-lists.js'
import { priceListKey, priceListsKey } from '../queries/price-lists.js'

export function useCreatePriceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createPriceList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListsKey })
    },
  })
}

export function useUpdatePriceList(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => updatePriceList(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListsKey })
      queryClient.invalidateQueries({ queryKey: priceListKey(id) })
    },
  })
}

export function useArchivePriceList(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => archivePriceList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListsKey })
      queryClient.invalidateQueries({ queryKey: priceListKey(id) })
    },
  })
}

export function useAddPriceListItem(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => addPriceListItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListKey(id) })
    },
  })
}

export function useUpdatePriceListItem(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, payload }) => updatePriceListItem(id, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListKey(id) })
    },
  })
}

export function useRemovePriceListItem(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId) => removePriceListItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceListKey(id) })
    },
  })
}
