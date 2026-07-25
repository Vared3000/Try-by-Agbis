import { useQuery } from '@tanstack/react-query'

import { getPriceList, listPriceLists } from '../services/price-lists.js'

export const priceListsKey = ['price-lists']
export const priceListKey = (id) => ['price-list', id]

export function usePriceLists(options = {}) {
  return useQuery({
    queryKey: priceListsKey,
    queryFn: listPriceLists,
    ...options,
  })
}

export function usePriceList(id, options = {}) {
  return useQuery({
    queryKey: priceListKey(id),
    queryFn: () => getPriceList(id),
    enabled: Boolean(id),
    ...options,
  })
}
