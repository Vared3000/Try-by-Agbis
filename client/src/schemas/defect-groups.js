import { z } from 'zod'

export const defectGroupSchema = z.object({
  name: z.string().trim().min(2, 'Минимум 2 символа'),
  defectIds: z.array(z.string()).default([]),
})
