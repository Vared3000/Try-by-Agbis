import { createHash, randomBytes } from 'node:crypto'

import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import bwipjs from 'bwip-js'
import QRCode from 'qrcode'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requireBranchAccess, requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const orderInput = z.object({
  branchId: z.string().uuid(),
  acceptanceLocationId: z.string().uuid(),
  clientId: z.string().uuid(),
  dueAt: z.iso.datetime().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
})

const decimalInput = z
  .union([
    z.string().regex(/^\d+([.,]\d{1,3})?$/),
    z.number().positive().safe(),
  ])
  .transform((value) => String(value).replace(',', '.'))

const itemInput = z
  .object({
    nomenclatureItemId: z.string().uuid().optional(),
    garmentTypeId: z.string().uuid().optional(),
    materialId: z.string().uuid().nullable().optional(),
    colorId: z.string().uuid().nullable().optional(),
    routeId: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    quantity: decimalInput.optional(),
    length: decimalInput.optional(),
    width: decimalInput.optional(),
  })
  .refine((value) => value.nomenclatureItemId || value.garmentTypeId, {
    message: 'Требуется позиция номенклатуры или тип изделия',
  })

const serviceInput = z.object({
  serviceId: z.string().uuid(),
  quantity: z
    .union([z.string().regex(/^\d+(\.\d{1,3})?$/), z.number().positive()])
    .transform(String),
})

const success = (data, correlationId, meta = {}) => ({
  data,
  meta: { correlationId, ...meta },
  error: null,
})

const missing = (code, message) => new ApiError({ status: 404, code, message })

function quantityMillis(value) {
  const [whole, fraction = ''] = value.split('.')
  const millis = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
  if (millis <= 0n)
    throw new ApiError({
      status: 422,
      code: 'ORDER_QUANTITY_INVALID',
      message: 'Количество должно быть положительным',
    })
  return millis
}

function millisToDecimal(value) {
  const whole = value / 1000n
  const fraction = String(value % 1000n).padStart(3, '0')
  return `${whole}.${fraction}`
}

const checkDigit = (value) =>
  String([...String(value)].reduce((sum, digit) => sum + Number(digit), 0) % 10)

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const requestHash = (value) => createHash('sha256').update(value).digest('hex')

export function createOrdersRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const models = sequelize.models
  router.use(authenticate)

  const findOrder = async (id, organizationId, options = {}) => {
    const order = await models.Order.findOne({
      where: { id, organizationId },
      ...options,
    })
    if (!order) throw missing('ORDER_NOT_FOUND', 'Заказ не найден')
    return order
  }

  const orderIncludes = [
    { model: models.Client, as: 'client' },
    {
      model: models.OrderItem,
      as: 'items',
      include: [
        { model: models.OrderItemService, as: 'services' },
        { model: models.NomenclatureItem, as: 'nomenclature' },
      ],
    },
  ]

  router.get('/', requirePermission('orders.view'), async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
    const where = {
      organizationId: req.auth.organizationId,
      branchId: { [Op.in]: req.auth.branchIds },
      ...(req.query.status ? { status: req.query.status } : {}),
    }
    const { rows, count } = await models.Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
    res.json(success(rows, req.correlationId, { page, pageSize, total: count }))
  })

  router.post(
    '/',
    requirePermission('orders.create'),
    requireBranchAccess((req) => req.body.branchId),
    async (req, res) => {
      const input = orderInput.parse(req.body)
      const order = await sequelize.transaction(async (transaction) => {
        const location = await models.Location.findOne({
          where: {
            id: input.acceptanceLocationId,
            branchId: input.branchId,
            organizationId: req.auth.organizationId,
            archivedAt: null,
          },
          transaction,
        })
        const client = await models.Client.findOne({
          where: {
            id: input.clientId,
            organizationId: req.auth.organizationId,
            archivedAt: null,
          },
          transaction,
        })
        if (!location || !client) {
          throw new ApiError({
            status: 422,
            code: 'ORDER_REFERENCE_INVALID',
            message: 'Клиент или точка приёма недоступны',
          })
        }

        const businessDate = new Date().toISOString().slice(0, 10)
        const [sequenceRow] = await models.NumberSequence.findOrCreate({
          where: {
            organizationId: req.auth.organizationId,
            acceptanceLocationId: location.id,
            businessDate,
          },
          defaults: { nextValue: 1 },
          transaction,
        })
        await sequenceRow.reload({ transaction, lock: transaction.LOCK.UPDATE })
        const sequence = String(sequenceRow.nextValue)
        await sequenceRow.update(
          { nextValue: (BigInt(sequence) + 1n).toString() },
          { transaction },
        )
        const displayNumber = `${location.code}-${sequence}-${checkDigit(sequence)}`
        return models.Order.create(
          {
            organizationId: req.auth.organizationId,
            ...input,
            sequence,
            displayNumber,
            acceptedOn: businessDate,
            status: 'draft',
            subtotalAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            paidAmount: 0,
            createdByUserId: req.auth.userId,
            version: 0,
          },
          { transaction },
        )
      })
      res.status(201).json(success(order, req.correlationId))
    },
  )

  router.get('/:id/receipt', requirePermission('orders.view'), async (req, res) => {
    const order = await findOrder(req.params.id, req.auth.organizationId, {
      include: orderIncludes,
    })
    if (!req.auth.branchIds.includes(order.branchId)) {
      throw missing('ORDER_NOT_FOUND', 'Заказ не найден')
    }
    const items = order.items
      .map(
        (item) =>
          `<li>${escapeHtml(item.description || item.scanCode)} — ${escapeHtml(
            item.totalAmount,
          )} RUB/100</li>`,
      )
      .join('')
    res.type('html').send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Заказ ${escapeHtml(
      order.displayNumber,
    )}</title></head>
<body><main><h1>Заказ ${escapeHtml(order.displayNumber)}</h1>
<p>Клиент: ${escapeHtml(order.client.fullName)}</p>
<ul>${items}</ul><strong>Итого: ${escapeHtml(order.totalAmount)} RUB/100</strong>
</main></body></html>`)
  })

  router.get(
    '/items/:itemId/labels',
    requirePermission('orders.view'),
    async (req, res) => {
      const item = await models.OrderItem.findOne({
        where: { id: req.params.itemId, organizationId: req.auth.organizationId },
        include: [{ model: models.Order, as: 'order', required: true }],
      })
      if (!item || !req.auth.branchIds.includes(item.order.branchId)) {
        throw missing('ORDER_ITEM_NOT_FOUND', 'Изделие не найдено')
      }
      const symbology = req.query.symbology
      const output = req.query.output
      if (req.query.layout === 'tag') {
        const qr = await QRCode.toBuffer(item.scanCode, {
          errorCorrectionLevel: 'H',
          margin: 4,
          width: 700,
        })
        const barcode = await bwipjs.toBuffer({
          bcid: 'code128',
          text: item.scanCode,
          includetext: false,
          scale: 4,
          height: 12,
        })
        res.set({
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg"
  width="55mm" height="55mm" viewBox="0 0 55 55">
  <rect width="55" height="55" fill="#fff"/>
  <text x="27.5" y="4" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="3.2" font-weight="700">${escapeHtml(
      item.order.displayNumber,
    )}</text>
  <image x="9.5" y="5" width="36" height="36"
    href="data:image/png;base64,${qr.toString('base64')}"/>
  <image x="3.5" y="42" width="48" height="8"
    preserveAspectRatio="none"
    href="data:image/png;base64,${barcode.toString('base64')}"/>
  <text x="27.5" y="53" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="2.2">${escapeHtml(item.scanCode)}</text>
</svg>`)
        return
      }
      if (symbology || output) {
        if (!['qr', 'code128'].includes(symbology) || !['svg', 'png'].includes(output)) {
          throw new ApiError({
            status: 400,
            code: 'LABEL_FORMAT_INVALID',
            message: 'Поддерживаются qr/code128 и svg/png',
          })
        }
        res.set({
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        if (symbology === 'qr') {
          if (output === 'svg') {
            res.type('image/svg+xml').send(
              await QRCode.toString(item.scanCode, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                margin: 4,
              }),
            )
          } else {
            res.type('image/png').send(
              await QRCode.toBuffer(item.scanCode, {
                errorCorrectionLevel: 'H',
                margin: 4,
                width: 512,
              }),
            )
          }
        } else if (output === 'svg') {
          res
            .type('image/svg+xml')
            .send(
              bwipjs.toSVG({ bcid: 'code128', text: item.scanCode, includetext: true }),
            )
        } else {
          res.type('image/png').send(
            await bwipjs.toBuffer({
              bcid: 'code128',
              text: item.scanCode,
              includetext: true,
              scale: 3,
              height: 15,
            }),
          )
        }
        return
      }
      res.json(
        success(
          {
            orderItemId: item.id,
            scanCode: item.scanCode,
            symbologies: ['qr', 'code128'],
          },
          req.correlationId,
        ),
      )
    },
  )

  router.get('/:id', requirePermission('orders.view'), async (req, res) => {
    const order = await findOrder(req.params.id, req.auth.organizationId, {
      include: orderIncludes,
    })
    if (!req.auth.branchIds.includes(order.branchId)) {
      throw missing('ORDER_NOT_FOUND', 'Заказ не найден')
    }
    res.json(success(order, req.correlationId))
  })

  router.post('/:id/items', requirePermission('orders.update'), async (req, res) => {
    const input = itemInput.parse(req.body)
    const item = await sequelize.transaction(async (transaction) => {
      const order = await findOrder(req.params.id, req.auth.organizationId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (order.status !== 'draft' || !req.auth.branchIds.includes(order.branchId)) {
        throw new ApiError({
          status: 409,
          code: 'ORDER_NOT_EDITABLE',
          message: 'Заказ нельзя изменить',
        })
      }
      const garment = input.garmentTypeId
        ? await models.GarmentType.findOne({
            where: {
              id: input.garmentTypeId,
              organizationId: req.auth.organizationId,
              archivedAt: null,
            },
            transaction,
          })
        : null
      const nomenclature = input.nomenclatureItemId
        ? await models.NomenclatureItem.findOne({
            where: {
              id: input.nomenclatureItemId,
              organizationId: req.auth.organizationId,
              archivedAt: null,
            },
            transaction,
          })
        : null
      if (
        (input.garmentTypeId && !garment) ||
        (input.nomenclatureItemId && !nomenclature)
      ) {
        throw new ApiError({
          status: 422,
          code: 'ORDER_ITEM_REFERENCE_INVALID',
          message: 'Позиция номенклатуры недоступна',
        })
      }

      let measurementMillis = 0n
      let quantity = input.quantity ?? null
      let length = input.length ?? null
      let width = input.width ?? null
      let area = null
      if (nomenclature) {
        if (nomenclature.unit === 'square_meter') {
          if (!length || !width) {
            throw new ApiError({
              status: 422,
              code: 'ORDER_ITEM_DIMENSIONS_REQUIRED',
              message: 'Для позиции в м² укажите длину и ширину',
            })
          }
          const lengthMillis = quantityMillis(length)
          const widthMillis = quantityMillis(width)
          measurementMillis = (lengthMillis * widthMillis + 500n) / 1000n
          area = millisToDecimal(measurementMillis)
          quantity = area
        } else if (nomenclature.unit === 'linear_meter') {
          if (!length) {
            throw new ApiError({
              status: 422,
              code: 'ORDER_ITEM_LENGTH_REQUIRED',
              message: 'Укажите длину в погонных метрах',
            })
          }
          measurementMillis = quantityMillis(length)
          quantity = length
          width = null
        } else {
          quantity = quantity ?? '1'
          measurementMillis = quantityMillis(quantity)
          length = null
          width = null
        }
      }
      const itemTotal = nomenclature
        ? (BigInt(nomenclature.unitPrice) * measurementMillis + 500n) / 1000n
        : 0n
      const item = await models.OrderItem.create(
        {
          organizationId: req.auth.organizationId,
          orderId: order.id,
          scanCode: randomBytes(24).toString('base64url'),
          ...input,
          garmentTypeId: garment?.id ?? null,
          nomenclatureItemId: nomenclature?.id ?? null,
          description: input.description || nomenclature?.name || null,
          quantity,
          length,
          width,
          area,
          unitPrice: nomenclature?.unitPrice ?? null,
          status: 'accepted',
          totalAmount: itemTotal.toString(),
          version: 0,
        },
        { transaction },
      )
      if (itemTotal > 0n) {
        const nextSubtotal = BigInt(order.subtotalAmount) + itemTotal
        await order.update(
          {
            subtotalAmount: nextSubtotal.toString(),
            totalAmount: nextSubtotal.toString(),
            version: order.version + 1,
          },
          { transaction },
        )
      }
      return item
    })
    res.status(201).json(success(item, req.correlationId))
  })

  router.post(
    '/items/:itemId/services',
    requirePermission('orders.update'),
    async (req, res) => {
      const input = serviceInput.parse(req.body)
      const snapshot = await sequelize.transaction(async (transaction) => {
        const item = await models.OrderItem.findOne({
          where: { id: req.params.itemId, organizationId: req.auth.organizationId },
          include: [{ model: models.Order, as: 'order', required: true }],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (
          !item ||
          item.order.status !== 'draft' ||
          !req.auth.branchIds.includes(item.order.branchId)
        ) {
          throw missing('ORDER_ITEM_NOT_FOUND', 'Изделие не найдено')
        }
        const priceList = await models.PriceList.findOne({
          where: {
            organizationId: req.auth.organizationId,
            status: 'active',
            validFrom: { [Op.lte]: item.order.acceptedOn },
            [Op.or]: [
              { validTo: null },
              { validTo: { [Op.gte]: item.order.acceptedOn } },
            ],
          },
          order: [['validFrom', 'DESC']],
          transaction,
        })
        if (!priceList) {
          throw new ApiError({
            status: 422,
            code: 'ACTIVE_PRICE_LIST_NOT_FOUND',
            message: 'Нет действующего прайс-листа',
          })
        }
        const price = await models.PriceListItem.findOne({
          where: {
            priceListId: priceList.id,
            serviceId: input.serviceId,
            garmentTypeId: item.garmentTypeId,
          },
          include: [{ model: models.Service, as: 'service' }],
          transaction,
        })
        if (!price || price.service.organizationId !== req.auth.organizationId) {
          throw new ApiError({
            status: 422,
            code: 'SERVICE_PRICE_NOT_FOUND',
            message: 'Цена услуги для изделия не найдена',
          })
        }
        const millis = quantityMillis(input.quantity)
        const total = (BigInt(price.price) * millis + 500n) / 1000n
        const service = await models.OrderItemService.create(
          {
            organizationId: req.auth.organizationId,
            orderItemId: item.id,
            serviceId: price.serviceId,
            serviceName: price.service.name,
            unitPrice: price.price,
            quantity: input.quantity,
            totalPrice: total.toString(),
          },
          { transaction },
        )
        const itemTotal = BigInt(item.totalAmount) + total
        await item.update(
          { totalAmount: itemTotal.toString(), version: item.version + 1 },
          { transaction },
        )
        const orderTotal = BigInt(item.order.subtotalAmount) + total
        await item.order.update(
          {
            subtotalAmount: orderTotal.toString(),
            totalAmount: orderTotal.toString(),
            version: item.order.version + 1,
          },
          { transaction },
        )
        return service
      })
      res.status(201).json(success(snapshot, req.correlationId))
    },
  )

  router.post('/:id/accept', requirePermission('orders.create'), async (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key')
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new ApiError({
        status: 400,
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Требуется корректный Idempotency-Key',
      })
    }
    const scope = `orders.accept:${req.auth.userId}`
    const hash = requestHash(req.params.id)
    const result = await sequelize.transaction(async (transaction) => {
      const existing = await models.IdempotencyKey.findOne({
        where: {
          organizationId: req.auth.organizationId,
          scope,
          key: idempotencyKey,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new ApiError({
            status: 409,
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            message: 'Ключ уже использован для другого запроса',
          })
        }
        return existing.responseBody
      }

      const current = await findOrder(req.params.id, req.auth.organizationId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!req.auth.branchIds.includes(current.branchId)) {
        throw missing('ORDER_NOT_FOUND', 'Заказ не найден')
      }
      if (current.status !== 'draft') {
        throw new ApiError({
          status: 409,
          code: 'ORDER_ALREADY_ACCEPTED',
          message: 'Заказ уже оформлен',
        })
      }
      const items = await models.OrderItem.findAll({
        where: { orderId: current.id, organizationId: req.auth.organizationId },
        include: [{ model: models.OrderItemService, as: 'services' }],
        transaction,
      })
      if (
        !items.length ||
        items.some((item) => !item.nomenclatureItemId && !item.services.length)
      ) {
        throw new ApiError({
          status: 422,
          code: 'ORDER_INCOMPLETE',
          message: 'У каждого изделия должна быть позиция номенклатуры или услуга',
        })
      }
      await current.update(
        { status: 'accepted', version: current.version + 1 },
        { transaction },
      )
      await models.OrderStatusHistory.create(
        {
          organizationId: req.auth.organizationId,
          orderId: current.id,
          fromStatus: 'draft',
          toStatus: 'accepted',
          changedByUserId: req.auth.userId,
          changedAt: new Date(),
        },
        { transaction },
      )
      const response = {
        id: current.id,
        displayNumber: current.displayNumber,
        status: current.status,
        subtotalAmount: String(current.subtotalAmount),
        totalAmount: String(current.totalAmount),
        version: current.version,
      }
      await models.IdempotencyKey.create(
        {
          organizationId: req.auth.organizationId,
          scope,
          key: idempotencyKey,
          requestHash: hash,
          responseStatus: 200,
          responseBody: response,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        { transaction },
      )
      return response
    })
    res.json(success(result, req.correlationId))
  })

  router.post('/:id/cancel', requirePermission('orders.cancel'), async (req, res) => {
    const order = await sequelize.transaction(async (transaction) => {
      const current = await findOrder(req.params.id, req.auth.organizationId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!req.auth.branchIds.includes(current.branchId)) {
        throw missing('ORDER_NOT_FOUND', 'Заказ не найден')
      }
      if (!['draft', 'accepted'].includes(current.status)) {
        throw new ApiError({
          status: 409,
          code: 'ORDER_CANNOT_BE_CANCELLED',
          message: 'Заказ нельзя отменить в текущем статусе',
        })
      }
      const fromStatus = current.status
      await current.update(
        { status: 'cancelled', version: current.version + 1 },
        { transaction },
      )
      await models.OrderStatusHistory.create(
        {
          organizationId: req.auth.organizationId,
          orderId: current.id,
          fromStatus,
          toStatus: 'cancelled',
          changedByUserId: req.auth.userId,
          reason: req.body?.reason?.slice(0, 500) || null,
          changedAt: new Date(),
        },
        { transaction },
      )
      return current
    })
    res.json(success(order, req.correlationId))
  })

  return router
}
