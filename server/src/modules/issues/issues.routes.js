import { Router } from 'express'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const issueInput = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(100),
  paymentOverrideReason: z.string().trim().min(1).max(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

export function createIssuesRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const models = sequelize.models
  router.use(authenticate)

  router.post(
    '/orders/:orderId/issues',
    requirePermission('orders.issue'),
    async (req, res) => {
      const input = issueInput.parse(req.body)
      const idempotencyKey = req.get('Idempotency-Key')
      if (!idempotencyKey || idempotencyKey.length > 128) {
        throw new ApiError({
          status: 400,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Требуется корректный Idempotency-Key',
        })
      }
      const result = await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', {
          replacements: {
            key: `${req.auth.organizationId}:issue:${idempotencyKey}`,
          },
          transaction,
        })
        const existing = await models.OrderIssue.findOne({
          where: { organizationId: req.auth.organizationId, idempotencyKey },
          include: [{ model: models.OrderIssueItem, as: 'items' }],
          transaction,
        })
        if (existing) {
          const existingIds = existing.items.map(({ orderItemId }) => orderItemId).sort()
          const requestedIds = [...new Set(input.itemIds)].sort()
          if (
            existing.orderId !== req.params.orderId ||
            JSON.stringify(existingIds) !== JSON.stringify(requestedIds)
          ) {
            throw new ApiError({
              status: 409,
              code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: 'Ключ уже использован для другой выдачи',
            })
          }
          return {
            issueId: existing.id,
            issuedItemIds: existingIds,
            replayed: true,
          }
        }
        const order = await models.Order.findOne({
          where: { id: req.params.orderId, organizationId: req.auth.organizationId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!order || !req.auth.branchIds.includes(order.branchId)) {
          throw new ApiError({
            status: 404,
            code: 'ORDER_NOT_FOUND',
            message: 'Заказ не найден',
          })
        }
        const uniqueIds = [...new Set(input.itemIds)]
        if (uniqueIds.length !== input.itemIds.length) {
          throw new ApiError({
            status: 400,
            code: 'ISSUE_ITEMS_DUPLICATED',
            message: 'Изделия в запросе не должны повторяться',
          })
        }
        const items = await models.OrderItem.findAll({
          where: {
            id: uniqueIds,
            orderId: order.id,
            organizationId: req.auth.organizationId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (items.length !== uniqueIds.length) {
          throw new ApiError({
            status: 404,
            code: 'ORDER_ITEM_NOT_FOUND',
            message: 'Изделие не найдено',
          })
        }
        if (items.some(({ status }) => status !== 'ready')) {
          throw new ApiError({
            status: 409,
            code: 'ITEM_NOT_READY',
            message: 'Все выбранные изделия должны быть готовы',
          })
        }
        const debt = BigInt(order.totalAmount) - BigInt(order.paidAmount)
        if (debt > 0n && !req.auth.permissions.includes('orders.issue_with_debt')) {
          throw new ApiError({
            status: 422,
            code: 'PAYMENT_REQUIRED',
            message: 'Перед выдачей требуется полная оплата',
          })
        }
        if (debt > 0n && !input.paymentOverrideReason) {
          throw new ApiError({
            status: 422,
            code: 'PAYMENT_OVERRIDE_REASON_REQUIRED',
            message: 'Укажите причину выдачи с долгом',
          })
        }
        const issue = await models.OrderIssue.create(
          {
            organizationId: req.auth.organizationId,
            orderId: order.id,
            idempotencyKey,
            issuedByUserId: req.auth.userId,
            issuedAt: new Date(),
            notes: input.paymentOverrideReason ?? input.notes ?? null,
          },
          { transaction },
        )
        await models.OrderIssueItem.bulkCreate(
          items.map((item) => ({
            organizationId: req.auth.organizationId,
            orderIssueId: issue.id,
            orderItemId: item.id,
          })),
          { transaction },
        )
        for (const item of items) {
          await item.update(
            { status: 'issued', version: item.version + 1 },
            { transaction },
          )
        }
        const remaining = await models.OrderItem.count({
          where: {
            orderId: order.id,
            organizationId: req.auth.organizationId,
            status: { [sequelize.Sequelize.Op.ne]: 'issued' },
          },
          transaction,
        })
        const fromStatus = order.status
        const orderStatus = remaining === 0 ? 'issued' : 'partially_issued'
        await order.update(
          { status: orderStatus, version: order.version + 1 },
          { transaction },
        )
        await models.OrderStatusHistory.create(
          {
            organizationId: req.auth.organizationId,
            orderId: order.id,
            fromStatus,
            toStatus: orderStatus,
            changedByUserId: req.auth.userId,
            reason: input.paymentOverrideReason ?? null,
            changedAt: new Date(),
          },
          { transaction },
        )
        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: 'order.issued',
            entityType: 'OrderIssue',
            entityId: issue.id,
            correlationId: req.correlationId,
            after: { orderId: order.id, itemIds: uniqueIds, orderStatus },
            occurredAt: new Date(),
          },
          { transaction },
        )
        await models.OutboxEvent.create(
          {
            organizationId: req.auth.organizationId,
            aggregateType: 'Order',
            aggregateId: order.id,
            type: 'order.issued',
            payload: { issueId: issue.id, itemIds: uniqueIds, orderStatus },
            occurredAt: new Date(),
          },
          { transaction },
        )
        return {
          issueId: issue.id,
          issuedItemIds: uniqueIds,
          orderStatus,
          replayed: false,
        }
      })
      res.status(201).json(success(result, req.correlationId))
    },
  )

  return router
}
