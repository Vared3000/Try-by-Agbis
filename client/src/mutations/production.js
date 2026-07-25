import { useMutation, useQueryClient } from '@tanstack/react-query'

import { transitionProductionItem } from '../services/production.js'

export function useTransitionProductionItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, stageId, action }) =>
      transitionProductionItem(itemId, { stageId, action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-items'] })
    },
  })
}
