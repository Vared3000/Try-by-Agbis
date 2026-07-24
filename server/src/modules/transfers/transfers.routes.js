import { randomUUID } from 'node:crypto'

import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const transferInput = z
  .object({
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => value.fromLocationId !== value.toLocationId, {
    message: 'Пункт отправления и пункт назначения должны отличаться',
  })

const addItemInput = z.object({
  scanCode: z.string().trim().min(1).max(128),
})

const receiveInput = z.object({
  receivedItemIds: z.array(z.string().uuid()).optional(),
})

const success = (data, correlationId, meta = {}) => ({
  data,
  meta: { correlationId, ...meta },
  error: null,
})

const transferError = (code, message, status = 409) =>
  new ApiError({ status, code, message })

const transferNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ПМ-${date}-${randomUUID().slice(0, 8).toUpperCase()}`
}

export function createTransfersRouter({ sequelize, env }) {
  const router = Router()
  const models = sequelize.models
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  router.use(authenticate)

  const location = (id, auth, transaction) =>
    models.Location.findOne({
      where: {
        id,
        organizationId: auth.organizationId,
        branchId: { [Op.in]: auth.branchIds },
        archivedAt: null,
      },
      transaction,
    })

  const itemInclude = {
    model: models.TransferDocumentItem,
    as: 'items',
    include: [
      {
        model: models.OrderItem,
        as: 'orderItem',
        include: [
          {
            model: models.Order,
            as: 'order',
            attributes: ['id', 'displayNumber', 'branchId', 'status'],
            include: [
              {
                model: models.Client,
                as: 'client',
                attributes: ['id', 'fullName', 'phone'],
              },
            ],
          },
          {
            model: models.NomenclatureItem,
            as: 'nomenclature',
            attributes: ['id', 'name', 'unit'],
          },
          {
            model: models.GarmentType,
            as: 'garmentType',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
  }

  const documentIncludes = [
    {
      model: models.Location,
      as: 'fromLocation',
      attributes: ['id', 'name', 'code', 'branchId'],
    },
    {
      model: models.Location,
      as: 'toLocation',
      attributes: ['id', 'name', 'code', 'branchId'],
    },
    {
      model: models.User,
      as: 'createdBy',
      attributes: ['id', 'displayName'],
    },
    itemInclude,
  ]

  const loadDocument = async (id, auth, options = {}) => {
    const document = await models.TransferDocument.findOne({
      where: { id, organizationId: auth.organizationId },
      include: documentIncludes,
      ...options,
    })
    if (
      !document ||
      !auth.branchIds.includes(document.fromLocation.branchId) ||
      !auth.branchIds.includes(document.toLocation.branchId)
    ) {
      throw transferError('TRANSFER_NOT_FOUND', 'Накладная перемещения не найдена', 404)
    }
    return document
  }

  router.get('/', requirePermission('orders.view'), async (req, res) => {
    const status = String(req.query.status ?? '').trim()
    const rows = await models.TransferDocument.findAll({
      where: {
        organizationId: req.auth.organizationId,
        ...(status ? { status } : {}),
      },
      include: [
        {
          model: models.Location,
          as: 'fromLocation',
          where: { branchId: { [Op.in]: req.auth.branchIds } },
          attributes: ['id', 'name', 'code', 'branchId'],
        },
        {
          model: models.Location,
          as: 'toLocation',
          where: { branchId: { [Op.in]: req.auth.branchIds } },
          attributes: ['id', 'name', 'code', 'branchId'],
        },
        {
          model: models.TransferDocumentItem,
          as: 'items',
          attributes: ['id', 'status'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('orders.update'), async (req, res) => {
    const input = transferInput.parse(req.body)
    const [fromLocation, toLocation] = await Promise.all([
      location(input.fromLocationId, req.auth),
      location(input.toLocationId, req.auth),
    ])
    if (!fromLocation || !toLocation) {
      throw transferError(
        'TRANSFER_LOCATION_DENIED',
        'Пункт перемещения не найден или недоступен',
        403,
      )
    }
    const document = await models.TransferDocument.create({
      organizationId: req.auth.organizationId,
      displayNumber: transferNumber(),
      fromLocationId: fromLocation.id,
      toLocationId: toLocation.id,
      status: 'draft',
      notes: input.notes ?? null,
      createdByUserId: req.auth.userId,
      sentAt: null,
      receivedAt: null,
      version: 0,
    })
    res.status(201).json(success(await loadDocument(document.id, req.auth), req.correlationId))
  })

  router.get('/:id', requirePermission('orders.view'), async (req, res) => {
    res.json(success(await loadDocument(req.params.id, req.auth), req.correlationId))
  })

  router.post(
    '/:id/items',
    requirePermission('orders.update'),
    async (req, res) => {
      const input = addItemInput.parse(req.body)
      const result = await sequelize.transaction(async (transaction) => {
        const document = await loadDocument(req.params.id, req.auth, { transaction })
        if (document.status !== 'draft') {
          throw transferError(
            'TRANSFER_NOT_EDITABLE',
            'Состав можно менять только в черновике накладной',
          )
        }
        const orderItem = await models.OrderItem.findOne({
          where: {
            scanCode: input.scanCode,
            organizationId: req.auth.organizationId,
          },
          include: [
            {
              model: models.Order,
              as: 'order',
              required: true,
              where: { branchId: { [Op.in]: req.auth.branchIds } },
            },
          ],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!orderItem) {
          throw transferError(
            'TRANSFER_ITEM_NOT_FOUND',
            'Изделие с таким кодом бирки не найдено',
            404,
          )
        }
        if (
          ['issued', 'cancelled', 'rejected'].includes(orderItem.status) ||
          ['draft', 'cancelled', 'issued'].includes(orderItem.order.status)
        ) {
          throw transferError(
            'TRANSFER_ITEM_LOCKED',
            'Черновое, отменённое или выданное изделие перемещать нельзя',
          )
        }
        const existing = await models.TransferDocumentItem.findOne({
          where: {
            transferDocumentId: document.id,
            orderItemId: orderItem.id,
          },
          transaction,
        })
        if (existing) {
          throw transferError(
            'TRANSFER_ITEM_DUPLICATE',
            'Это изделие уже добавлено в накладную',
          )
        }
        const activeTransfer = await models.TransferDocumentItem.findOne({
          where: {
            organizationId: req.auth.organizationId,
            orderItemId: orderItem.id,
          },
          include: [
            {
              model: models.TransferDocument,
              as: 'transferDocument',
              where: { status: 'in_transit' },
              required: true,
            },
          ],
          transaction,
        })
        if (activeTransfer) {
          throw transferError(
            'TRANSFER_ITEM_IN_TRANSIT',
            'Изделие уже находится в пути по другой накладной',
          )
        }
        const latestMovement = await models.ItemMovement.findOne({
          where: {
            organizationId: req.auth.organizationId,
            orderItemId: orderItem.id,
          },
          order: [
            ['movedAt', 'DESC'],
            ['createdAt', 'DESC'],
          ],
          transaction,
        })
        const currentLocationId =
          latestMovement?.toLocationId ?? orderItem.order.acceptanceLocationId
        if (currentLocationId !== document.fromLocationId) {
          throw transferError(
            'TRANSFER_ITEM_WRONG_LOCATION',
            'Изделие сейчас находится в другом подразделении',
          )
        }
        await models.TransferDocumentItem.create(
          {
            organizationId: req.auth.organizationId,
            transferDocumentId: document.id,
            orderItemId: orderItem.id,
            status: 'planned',
          },
          { transaction },
        )
        return document.id
      })
      res
        .status(201)
        .json(success(await loadDocument(result, req.auth), req.correlationId))
    },
  )

  router.delete(
    '/:id/items/:itemId',
    requirePermission('orders.update'),
    async (req, res) => {
      await sequelize.transaction(async (transaction) => {
        const document = await loadDocument(req.params.id, req.auth, { transaction })
        if (document.status !== 'draft') {
          throw transferError(
            'TRANSFER_NOT_EDITABLE',
            'Состав можно менять только в черновике накладной',
          )
        }
        const item = await models.TransferDocumentItem.findOne({
          where: {
            id: req.params.itemId,
            transferDocumentId: document.id,
            organizationId: req.auth.organizationId,
          },
          transaction,
        })
        if (!item) {
          throw transferError(
            'TRANSFER_DOCUMENT_ITEM_NOT_FOUND',
            'Позиция накладной не найдена',
            404,
          )
        }
        await item.destroy({ transaction })
      })
      res.status(204).send()
    },
  )

  router.post(
    '/:id/send',
    requirePermission('orders.update'),
    async (req, res) => {
      await sequelize.transaction(async (transaction) => {
        const document = await loadDocument(req.params.id, req.auth, { transaction })
        if (document.status !== 'draft') {
          throw transferError(
            'TRANSFER_ALREADY_SENT',
            'Отправить можно только черновик накладной',
          )
        }
        if (!document.items.length) {
          throw transferError(
            'TRANSFER_EMPTY',
            'Перед отправкой добавьте хотя бы одно изделие',
          )
        }
        const before = document.status
        await document.update(
          {
            status: 'in_transit',
            sentAt: new Date(),
            version: document.version + 1,
          },
          { transaction },
        )
        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: 'transfer.sent',
            entityType: 'TransferDocument',
            entityId: document.id,
            correlationId: req.correlationId,
            before: { status: before },
            after: { status: document.status, itemCount: document.items.length },
            occurredAt: new Date(),
          },
          { transaction },
        )
      })
      res.json(
        success(await loadDocument(req.params.id, req.auth), req.correlationId),
      )
    },
  )

  router.post(
    '/:id/receive',
    requirePermission('orders.update'),
    async (req, res) => {
      const input = receiveInput.parse(req.body)
      await sequelize.transaction(async (transaction) => {
        const document = await loadDocument(req.params.id, req.auth, { transaction })
        if (document.status !== 'in_transit') {
          throw transferError(
            'TRANSFER_NOT_IN_TRANSIT',
            'Принять можно только накладную со статусом «В пути»',
          )
        }
        const selectedIds = input.receivedItemIds
          ? new Set(input.receivedItemIds)
          : new Set(document.items.map((item) => item.id))
        const unknown = [...selectedIds].some(
          (id) => !document.items.some((item) => item.id === id),
        )
        if (unknown) {
          throw transferError(
            'TRANSFER_RECEIVE_ITEM_INVALID',
            'В списке приёмки есть изделие не из этой накладной',
            422,
          )
        }
        const now = new Date()
        for (const item of document.items) {
          const received = selectedIds.has(item.id)
          await item.update({ status: received ? 'received' : 'missing' }, { transaction })
          if (received) {
            await models.ItemMovement.create(
              {
                organizationId: req.auth.organizationId,
                orderItemId: item.orderItemId,
                fromLocationId: document.fromLocationId,
                toLocationId: document.toLocationId,
                movedByUserId: req.auth.userId,
                movedAt: now,
                reason: `Перемещение по накладной ${document.displayNumber}`,
              },
              { transaction },
            )
          }
        }
        await document.update(
          {
            status: 'received',
            receivedAt: now,
            version: document.version + 1,
          },
          { transaction },
        )
        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: 'transfer.received',
            entityType: 'TransferDocument',
            entityId: document.id,
            correlationId: req.correlationId,
            before: { status: 'in_transit' },
            after: {
              status: 'received',
              receivedCount: selectedIds.size,
              missingCount: document.items.length - selectedIds.size,
            },
            occurredAt: now,
          },
          { transaction },
        )
      })
      res.json(
        success(await loadDocument(req.params.id, req.auth), req.correlationId),
      )
    },
  )

  return router
}
