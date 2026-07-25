import { useQuery } from '@tanstack/react-query'

import { listDefectGroups } from '../services/defect-groups.js'

export const defectGroupsKey = ['defect-groups']

export function useDefectGroups(options = {}) {
  return useQuery({
    queryKey: defectGroupsKey,
    queryFn: listDefectGroups,
    ...options,
  })
}
