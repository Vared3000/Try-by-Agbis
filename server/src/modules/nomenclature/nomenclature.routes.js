import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const units = ['piece', 'square_meter', 'linear_meter', 'kilogram']
const calculationTypes = {
  piece: 'quantity',
  square_meter: 'area',
  linear_meter: 'length',
  kilogram: 'weight',
}
const moneyValue = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()])
  .transform(String)

const createInput = z.object({
  name: z.string().trim().min(2).max(255),
  unit: z.enum(units),
  unitPrice: moneyValue,
})

const updateInput = createInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const missing = () =>
  new ApiError({
    status: 404,
    code: 'NOMENCLATURE_ITEM_NOT_FOUND',
    message: 'Позиция номенклатуры не найдена',
  })

export function createNomenclatureRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const { NomenclatureItem } = sequelize.models
  router.use(authenticate)

  router.get('/', requirePermission('catalog.view'), async (req, res) => {
    const search = String(req.query.search ?? '').trim()
    const rows = await NomenclatureItem.findAll({
      where: {
        organizationId: req.auth.organizationId,
        archivedAt: null,
        ...(search ? { name: { [Op.iLike]: `%${search}%` } } : {}),
      },
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('catalog.manage'), async (req, res) => {
    const input = createInput.parse(req.body)
    const row = await NomenclatureItem.create({
      organizationId: req.auth.organizationId,
      ...input,
      calculationType: calculationTypes[input.unit],
      currency: 'RUB',
      version: 0,
    })
    res.status(201).json(success(row, req.correlationId))
  })

  router.patch('/:id', requirePermission('catalog.manage'), async (req, res) => {
    const input = updateInput.parse(req.body)
    const row = await NomenclatureItem.findOne({
      where: {
        id: req.params.id,
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
    })
    if (!row) throw missing()
    await row.update({
      ...input,
      ...(input.unit ? { calculationType: calculationTypes[input.unit] } : {}),
      version: row.version + 1,
    })
    res.json(success(row, req.correlationId))
  })

  router.delete('/:id', requirePermission('catalog.manage'), async (req, res) => {
    const [updated] = await NomenclatureItem.update(
      { archivedAt: new Date() },
      {
        where: {
          id: req.params.id,
          organizationId: req.auth.organizationId,
          archivedAt: null,
        },
      },
    )
    if (!updated) throw missing()
    res.json(success({ archived: true }, req.correlationId))
  })

  return router
}
