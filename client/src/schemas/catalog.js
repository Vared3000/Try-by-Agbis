import { z } from 'zod'

export const catalogEntrySchema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
})

export const serviceSchema = z.object({
  code: z.string().trim().min(1, 'Введите код'),
  name: z.string().trim().min(1, 'Введите название'),
  unit: z.string().default('item'),
  categoryId: z.string().optional().default(''),
})
