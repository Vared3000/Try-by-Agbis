import { useQuery } from '@tanstack/react-query'

import { getTransfer, listTransfers } from '../services/transfers.js'

export const transfersKey = ['transfers']
export const transferKey = (id) => ['transfers', id]

export function useTransfers(options = {}) {
  return useQuery({
    queryKey: transfersKey,
    queryFn: listTransfers,
    ...options,
  })
}

export function useTransfer(id, options = {}) {
  return useQuery({
    queryKey: transferKey(id),
    queryFn: () => getTransfer(id),
    enabled: Boolean(id),
    ...options,
  })
}
