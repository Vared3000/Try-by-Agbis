import { Router } from 'express'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const catalogInput = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(255),
  hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
})

const serviceInput = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(255),
  unit: z.string().trim().min(1).max(32),
})

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const resources = {
  'service-categories': 'ServiceCategory',
  'garment-types': 'GarmentType',
  materials: 'Material',
  colors: 'Color',
  defects: 'Defect',
  contaminations: 'Contamination',
}

function notFound() {
  return new ApiError({
    status: 404,
    code: 'CATALOG_ITEM_NOT_FOUND',
    message: 'Элемент справочника не найден',
  })
}

export function createCatalogRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  router.use(authenticate)

  for (const [path, modelName] of Object.entries(resources)) {
    const Model = sequelize.models[modelName]

    router.get(`/${path}`, requirePermission('catalog.view'), async (req, res) => {
      const rows = await Model.findAll({
        where: { organizationId: req.auth.organizationId, archivedAt: null },
        order: [
          ['name', 'ASC'],
          ['id', 'ASC'],
        ],
      })
      res.json(success(rows, req.correlationId))
    })

    router.post(`/${path}`, requirePermission('catalog.manage'), async (req, res) => {
      const input = catalogInput.parse(req.body)
      const row = await Model.create({
        organizationId: req.auth.organizationId,
        ...input,
      })
      res.status(201).json(success(row, req.correlationId))
    })

    router.patch(
      `/${path}/:id`,
      requirePermission('catalog.manage'),
      async (req, res) => {
        const input = catalogInput.partial().parse(req.body)
        const row = await Model.findOne({
          where: {
            id: req.params.id,
            organizationId: req.auth.organizationId,
            archivedAt: null,
          },
        })
        if (!row) throw notFound()
        await row.update(input)
        res.json(success(row, req.correlationId))
      },
    )

    router.delete(
      `/${path}/:id`,
      requirePermission('catalog.manage'),
      async (req, res) => {
        const [updated] = await Model.update(
          { archivedAt: new Date() },
          {
            where: {
              id: req.params.id,
              organizationId: req.auth.organizationId,
              archivedAt: null,
            },
          },
        )
        if (!updated) throw notFound()
        res.json(success({ archived: true }, req.correlationId))
      },
    )
  }

  return router
}

export function createServicesRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const { Service, ServiceCategory } = sequelize.models
  router.use(authenticate)

  const requireCategory = async (categoryId, organizationId) => {
    if (!categoryId) return
    const category = await ServiceCategory.findOne({
      where: { id: categoryId, organizationId, archivedAt: null },
    })
    if (!category) throw notFound()
  }

  router.get('/', requirePermission('catalog.view'), async (req, res) => {
    const rows = await Service.findAll({
      where: { organizationId: req.auth.organizationId, archivedAt: null },
      include: [{ model: ServiceCategory, as: 'category' }],
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('catalog.manage'), async (req, res) => {
    const input = serviceInput.parse(req.body)
    await requireCategory(input.categoryId, req.auth.organizationId)
    const service = await Service.create({
      organizationId: req.auth.organizationId,
      ...input,
      version: 0,
    })
    res.status(201).json(success(service, req.correlationId))
  })

  router.patch('/:id', requirePermission('catalog.manage'), async (req, res) => {
    const input = serviceInput.partial().parse(req.body)
    await requireCategory(input.categoryId, req.auth.organizationId)
    const service = await Service.findOne({
      where: {
        id: req.params.id,
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
    })
    if (!service) throw notFound()
    await service.update({ ...input, version: service.version + 1 })
    res.json(success(service, req.correlationId))
  })

  router.delete('/:id', requirePermission('catalog.manage'), async (req, res) => {
    const service = await Service.findOne({
      where: {
        id: req.params.id,
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
    })
    if (!service) throw notFound()
    await service.update({ archivedAt: new Date(), version: service.version + 1 })
    res.json(success({ archived: true }, req.correlationId))
  })

  return router
}
