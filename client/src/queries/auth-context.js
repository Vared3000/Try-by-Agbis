import { useQuery } from '@tanstack/react-query'

import { getAuthContext } from '../services/auth-context.js'

export const authContextKey = ['auth-context']

export function useAuthContext(options = {}) {
  return useQuery({
    queryKey: authContextKey,
    queryFn: getAuthContext,
    ...options,
  })
}
