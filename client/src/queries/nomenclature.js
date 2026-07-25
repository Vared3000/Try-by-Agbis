import { useQuery } from '@tanstack/react-query'

import { listNomenclature } from '../services/nomenclature.js'

export const nomenclatureKey = (search = '') => ['nomenclature', search]

export function useNomenclature(search = '', options = {}) {
  return useQuery({
    queryKey: nomenclatureKey(search),
    queryFn: () => listNomenclature(search),
    ...options,
  })
}
