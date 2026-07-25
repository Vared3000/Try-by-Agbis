import { z } from 'zod'

export const nomenclatureItemSchema = z.object({
  name: z.string().trim().min(2, 'Минимум 2 символа').max(255),
  unit: z.enum(['piece', 'square_meter', 'linear_meter', 'kilogram']),
  price: z.string().trim().min(1, 'Введите цену'),
  length: z.string().optional().default(''),
  width: z.string().optional().default(''),
  leadTimeHours: z.string().trim().min(1, 'Введите норматив'),
  defectGroupId: z.string().optional().default(''),
})
