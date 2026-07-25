import { z } from 'zod'

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: 'Некорректный email',
  })

export const clientContactSchema = z.object({
  fullName: z.string().trim().min(2, 'Минимум 2 символа'),
  phone: z.string().trim().optional().default(''),
  email: optionalEmail,
  address: z.string().trim().min(5, 'Минимум 5 символов'),
})

export const clientEditSchema = clientContactSchema.extend({
  notes: z.string().optional().default(''),
})
