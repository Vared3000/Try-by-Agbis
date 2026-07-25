import { z } from 'zod'

export const priceListCreateSchema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
  validFrom: z.string().trim().min(1, 'Укажите дату начала'),
  validTo: z.string().optional().default(''),
  status: z.enum(['draft', 'active']).default('active'),
})

export const priceListItemSchema = z
  .object({
    kind: z.enum(['nomenclature', 'service']),
    nomenclatureItemId: z.string().optional().default(''),
    serviceId: z.string().optional().default(''),
    price: z.string().trim().min(1, 'Введите цену'),
  })
  .refine(
    (value) =>
      value.kind === 'service' ? Boolean(value.serviceId) : Boolean(value.nomenclatureItemId),
    { message: 'Выберите позицию', path: ['nomenclatureItemId'] },
  )

export const priceEditSchema = z.object({
  price: z.string().trim().min(1, 'Введите цену'),
})
