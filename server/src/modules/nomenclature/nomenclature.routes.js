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
  leadTimeHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
  defectGroupId: z.string().uuid().nullable().optional(),
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
  const { NomenclatureItem, DefectGroup, Defect } = sequelize.models
  router.use(authenticate)
  const groupInclude = {
    model: DefectGroup,
    as: 'defectGroup',
    required: false,
    where: { archivedAt: null },
    include: [
      {
        model: Defect,
        as: 'defects',
        required: false,
        through: { attributes: [] },
        where: { archivedAt: null },
      },
    ],
  }

  const validateGroup = async (defectGroupId, organizationId, transaction) => {
    if (!defectGroupId) return null
    const group = await DefectGroup.findOne({
      where: {
        id: defectGroupId,
        organizationId,
        archivedAt: null,
      },
      transaction,
    })
    if (!group) {
      throw new ApiError({
        status: 422,
        code: 'NOMENCLATURE_DEFECT_GROUP_INVALID',
        message: 'Выбранная группа дефектов недоступна',
      })
    }
    return group.id
  }

  router.get('/', requirePermission('catalog.view'), async (req, res) => {
    const search = String(req.query.search ?? '').trim()
    const rows = await NomenclatureItem.findAll({
      where: {
        organizationId: req.auth.organizationId,
        archivedAt: null,
        ...(search ? { name: { [Op.iLike]: `%${search}%` } } : {}),
      },
      include: [groupInclude],
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('catalog.manage'), async (req, res) => {
    const input = createInput.parse(req.body)
    const defectGroupId = await validateGroup(
      input.defectGroupId,
      req.auth.organizationId,
    )
    const row = await NomenclatureItem.create({
      organizationId: req.auth.organizationId,
      ...input,
      leadTimeHours: input.leadTimeHours ?? 48,
      defectGroupId,
      calculationType: calculationTypes[input.unit],
      currency: 'RUB',
      version: 0,
    })
    const created = await NomenclatureItem.findByPk(row.id, {
      include: [groupInclude],
    })
    res.status(201).json(success(created, req.correlationId))
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
    if (Object.hasOwn(input, 'defectGroupId')) {
      await validateGroup(input.defectGroupId, req.auth.organizationId)
    }
    await row.update({
      ...input,
      ...(input.unit ? { calculationType: calculationTypes[input.unit] } : {}),
      version: row.version + 1,
    })
    const updated = await NomenclatureItem.findByPk(row.id, {
      include: [groupInclude],
    })
    res.json(success(updated, req.correlationId))
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
