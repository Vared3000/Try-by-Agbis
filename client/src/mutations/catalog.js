import { useMutation, useQueryClient } from '@tanstack/react-query'

import { archiveCatalogEntry, createCatalogEntry, updateCatalogEntry } from '../services/catalog.js'
import { catalogKey } from '../queries/catalog.js'

export function useSaveCatalogEntry(path) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) =>
      id ? updateCatalogEntry(path, id, payload) : createCatalogEntry(path, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKey(path) })
    },
  })
}

export function useCreateCatalogEntry(path) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => createCatalogEntry(path, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKey(path) })
    },
  })
}

export function useArchiveCatalogEntry(path) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => archiveCatalogEntry(path, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKey(path) })
    },
  })
}
