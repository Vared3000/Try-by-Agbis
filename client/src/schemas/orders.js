import { z } from 'zod'

// acceptanceLocationId/issueLocationId/priceListId intentionally allow '' —
// the UI falls back to the first available option from freshly-loaded
// reference data (branches/price lists) when the form hasn't picked one yet,
// so an empty string here is a valid "use the default" state, not invalid
// input. The create button itself stays gated on a resolved location id.
export const orderCreateSchema = z.object({
  clientId: z.string().min(1, 'Выберите клиента'),
  branchId: z.string().optional().default(''),
  acceptanceLocationId: z.string().optional().default(''),
  issueLocationId: z.string().optional().default(''),
  priceListId: z.string().optional().default(''),
  acceptedOn: z.string().optional().default(''),
  dueAt: z.string().optional().default(''),
  urgency: z.enum(['normal', 'urgent', 'express']).default('normal'),
  notificationPhone: z.string().optional().default(''),
  isRework: z.boolean().default(false),
  notes: z.string().optional().default(''),
})

export const orderMetaSchema = z.object({
  clientId: z.string().min(1, 'Выберите клиента'),
  issueLocationId: z.string().min(1, 'Выберите точку выдачи'),
  priceListId: z.string().optional().default(''),
  dueAt: z.string().optional().default(''),
  urgency: z.enum(['normal', 'urgent', 'express']).default('normal'),
  notificationPhone: z.string().optional().default(''),
  isRework: z.boolean().default(false),
  notes: z.string().optional().default(''),
})
