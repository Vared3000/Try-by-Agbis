import { useMutation, useQueryClient } from '@tanstack/react-query'

import { archiveDefectGroup, createDefectGroup, updateDefectGroup } from '../services/defect-groups.js'
import { defectGroupsKey } from '../queries/defect-groups.js'

function invalidateDefectGroups(queryClient) {
  queryClient.invalidateQueries({ queryKey: defectGroupsKey })
  queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
}

export function useSaveDefectGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) =>
      id ? updateDefectGroup(id, payload) : createDefectGroup(payload),
    onSuccess: () => invalidateDefectGroups(queryClient),
  })
}

export function useArchiveDefectGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => archiveDefectGroup(id),
    onSuccess: () => invalidateDefectGroups(queryClient),
  })
}
