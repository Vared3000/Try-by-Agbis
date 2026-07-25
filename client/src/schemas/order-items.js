import { z } from 'zod'

export const orderItemSchema = z.object({
  nomenclatureItemId: z.string().min(1, 'Выберите позицию'),
  materialId: z.string().optional().default(''),
  colorId: z.string().optional().default(''),
  description: z.string().optional().default(''),
  quantity: z.string().optional().default('1'),
  length: z.string().optional().default(''),
  width: z.string().optional().default(''),
  defectIds: z.array(z.string()).default([]),
  contaminationIds: z.array(z.string()).default([]),
})

export const measurementSchema = z.object({
  length: z.string().trim().min(1, 'Введите длину'),
  width: z.string().optional().default(''),
})

export const serviceAdderSchema = z.object({
  serviceId: z.string().min(1, 'Выберите услугу'),
  quantity: z.string().trim().min(1, 'Введите количество'),
})
