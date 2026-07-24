import { Router } from 'express'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const priceListInput = z.object({
  name: z.string().trim().min(1).max(255),
  validFrom: z.iso.date(),
  validTo: z.iso.date().nullable().optional(),
  status: z.enum(['draft', 'active', 'inactive']).default('draft'),
})

const itemInput = z.object({
  serviceId: z.string().uuid(),
  garmentTypeId: z.string().uuid().nullable().optional(),
  price: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()])
    .transform(String),
})

const itemPriceInput = itemInput.pick({ price: true })

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const missing = () =>
  new ApiError({
    status: 404,
    code: 'PRICE_LIST_NOT_FOUND',
    message: 'Прайс-лист не найден',
  })

export function createPriceListsRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const { PriceList, PriceListItem, Service, GarmentType } = sequelize.models
  router.use(authenticate)

  const findPriceList = async (id, organizationId, options = {}) => {
    const row = await PriceList.findOne({
      where: { id, organizationId },
      ...options,
    })
    if (!row) throw missing()
    return row
  }

  const findPriceListItem = async (priceListId, itemId, organizationId) => {
    const row = await PriceListItem.findOne({
      where: {
        id: itemId,
        priceListId,
        organizationId,
      },
    })
    if (!row) {
      throw new ApiError({
        status: 404,
        code: 'PRICE_LIST_ITEM_NOT_FOUND',
        message: 'Строка прайс-листа не найдена',
      })
    }
    return row
  }

  router.get('/', requirePermission('catalog.view'), async (req, res) => {
    const rows = await PriceList.findAll({
      where: { organizationId: req.auth.organizationId },
      order: [
        ['validFrom', 'DESC'],
        ['id', 'ASC'],
      ],
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('price_lists.manage'), async (req, res) => {
    const input = priceListInput.parse(req.body)
    const row = await PriceList.create({
      organizationId: req.auth.organizationId,
      ...input,
      version: 0,
    })
    res.status(201).json(success(row, req.correlationId))
  })

  router.get('/:id', requirePermission('catalog.view'), async (req, res) => {
    const row = await findPriceList(req.params.id, req.auth.organizationId, {
      include: [
        {
          model: PriceListItem,
          as: 'items',
          include: [
            { model: Service, as: 'service' },
            { model: GarmentType, as: 'garmentType' },
          ],
        },
      ],
    })
    res.json(success(row, req.correlationId))
  })

  router.patch('/:id', requirePermission('price_lists.manage'), async (req, res) => {
    const input = priceListInput.partial().parse(req.body)
    const row = await findPriceList(req.params.id, req.auth.organizationId)
    await row.update({ ...input, version: row.version + 1 })
    res.json(success(row, req.correlationId))
  })

  router.post('/:id/items', requirePermission('price_lists.manage'), async (req, res) => {
    const input = itemInput.parse(req.body)
    const priceList = await findPriceList(req.params.id, req.auth.organizationId)
    if (priceList.status === 'inactive') {
      throw new ApiError({
        status: 409,
        code: 'PRICE_LIST_INACTIVE',
        message: 'Неактивный прайс-лист нельзя изменять',
      })
    }
    const service = await Service.findOne({
      where: {
        id: input.serviceId,
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
    })
    const garmentType = input.garmentTypeId
      ? await GarmentType.findOne({
          where: {
            id: input.garmentTypeId,
            organizationId: req.auth.organizationId,
            archivedAt: null,
          },
        })
      : true
    if (!service || !garmentType) {
      throw new ApiError({
        status: 422,
        code: 'PRICE_LIST_REFERENCE_INVALID',
        message: 'Услуга или тип изделия недоступны',
      })
    }
    const item = await PriceListItem.create({
      organizationId: req.auth.organizationId,
      priceListId: priceList.id,
      ...input,
    })
    res.status(201).json(success(item, req.correlationId))
  })

  router.patch(
    '/:id/items/:itemId',
    requirePermission('price_lists.manage'),
    async (req, res) => {
      const input = itemPriceInput.parse(req.body)
      const priceList = await findPriceList(req.params.id, req.auth.organizationId)
      if (priceList.status === 'inactive') {
        throw new ApiError({
          status: 409,
          code: 'PRICE_LIST_INACTIVE',
          message: 'Неактивный прайс-лист нельзя изменять',
        })
      }
      const item = await findPriceListItem(
        priceList.id,
        req.params.itemId,
        req.auth.organizationId,
      )
      await item.update(input)
      res.json(success(item, req.correlationId))
    },
  )

  router.delete(
    '/:id/items/:itemId',
    requirePermission('price_lists.manage'),
    async (req, res) => {
      const priceList = await findPriceList(req.params.id, req.auth.organizationId)
      if (priceList.status === 'inactive') {
        throw new ApiError({
          status: 409,
          code: 'PRICE_LIST_INACTIVE',
          message: 'Неактивный прайс-лист нельзя изменять',
        })
      }
      const item = await findPriceListItem(
        priceList.id,
        req.params.itemId,
        req.auth.organizationId,
      )
      await item.destroy()
      res.json(success({ deleted: true }, req.correlationId))
    },
  )

  router.delete('/:id', requirePermission('price_lists.manage'), async (req, res) => {
    const row = await findPriceList(req.params.id, req.auth.organizationId)
    await row.update({ status: 'inactive', version: row.version + 1 })
    res.json(success({ archived: true }, req.correlationId))
  })

  return router
}
