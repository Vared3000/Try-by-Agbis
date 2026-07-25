import { useQuery } from '@tanstack/react-query'

import { listProductionItems, listProductionRoutes } from '../services/production.js'

export const productionRoutesKey = ['production-routes']
export const productionItemsKey = (search = '', status = '') => [
  'production-items',
  search,
  status,
]

export function useProductionRoutes(options = {}) {
  return useQuery({
    queryKey: productionRoutesKey,
    queryFn: listProductionRoutes,
    ...options,
  })
}

export function useProductionItems(search = '', status = '', options = {}) {
  return useQuery({
    queryKey: productionItemsKey(search, status),
    queryFn: () => listProductionItems({ search, status }),
    ...options,
  })
}
