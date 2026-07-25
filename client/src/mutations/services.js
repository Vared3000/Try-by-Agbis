import { useMutation, useQueryClient } from '@tanstack/react-query'

import { archiveService, createService, updateService } from '../services/services.js'
import { servicesKey } from '../queries/services.js'

export function useSaveService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => (id ? updateService(id, payload) : createService(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKey })
    },
  })
}

export function useArchiveService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => archiveService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesKey })
    },
  })
}
