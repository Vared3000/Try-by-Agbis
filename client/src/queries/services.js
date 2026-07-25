import { useQuery } from '@tanstack/react-query'

import { listServices } from '../services/services.js'

export const servicesKey = ['services']

export function useServices(options = {}) {
  return useQuery({
    queryKey: servicesKey,
    queryFn: listServices,
    ...options,
  })
}
