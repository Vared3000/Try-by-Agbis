import { z } from 'zod'

// fromLocationId/toLocationId allow '' — the UI falls back to the first
// available location (and the first different one for "to") while branch
// data loads, same rationale as orderCreateSchema.
export const transferCreateSchema = z.object({
  fromLocationId: z.string().optional().default(''),
  toLocationId: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})
