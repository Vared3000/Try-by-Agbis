import { useMutation, useQueryClient } from '@tanstack/react-query'

import { addClientAddress, createClient, updateClient } from '../services/clients.js'
import { clientKey } from '../queries/clients.js'

export function useCreateClientWithAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ fullName, phone, email, address }) => {
      const client = await createClient({
        fullName,
        phone: phone || null,
        email: email || null,
      })
      await addClientAddress(client.id, { address, isPrimary: true })
      return client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClientWithAddress(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ fullName, phone, email, notes, address, previousAddress }) => {
      await updateClient(id, {
        fullName,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      })
      const trimmedAddress = address.trim()
      if (trimmedAddress !== (previousAddress ?? '')) {
        await addClientAddress(id, { address: trimmedAddress, isPrimary: true })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKey(id) })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
