import { z } from 'zod'

const optionalText = (max) => z.string().trim().max(max).nullable().optional()

export const clientListSchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const clientCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  phone: optionalText(32),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  notes: optionalText(5000),
})

export const clientUpdateSchema = clientCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const addressCreateSchema = z.object({
  label: optionalText(64),
  address: z.string().trim().min(1).max(2000),
  isPrimary: z.boolean().default(false),
})

export const consentCreateSchema = z.object({
  type: z.string().trim().min(1).max(64),
  textVersion: z.string().trim().min(1).max(64),
  granted: z.boolean(),
  channel: z.string().trim().min(1).max(32),
})
