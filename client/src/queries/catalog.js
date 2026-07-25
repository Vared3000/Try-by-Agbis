import { useQuery } from '@tanstack/react-query'

import { listCatalog } from '../services/catalog.js'

export const catalogKey = (path) => ['catalog', path]

export function useCatalog(path, options = {}) {
  return useQuery({
    queryKey: catalogKey(path),
    queryFn: () => listCatalog(path),
    ...options,
  })
}
