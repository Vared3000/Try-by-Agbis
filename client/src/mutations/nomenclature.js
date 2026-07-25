import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  archiveNomenclatureItem,
  createNomenclatureItem,
  updateNomenclatureItem,
} from '../services/nomenclature.js'

export function useSaveNomenclatureItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) =>
      id ? updateNomenclatureItem(id, payload) : createNomenclatureItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
    },
  })
}

export function useArchiveNomenclatureItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => archiveNomenclatureItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
    },
  })
}
