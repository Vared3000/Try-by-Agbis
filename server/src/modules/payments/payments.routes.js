import { Router } from 'express'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requireBranchAccess, requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const money = z
  .union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive().safe()])
  .transform(String)

const shiftOpenInput = z.object({
  branchId: z.string().uuid(),
  workplaceId: z.string().uuid(),
  openingAmount: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()])
    .transform(String),
})

const currentShiftInput = z.object({
  branchId: z.string().uuid(),
})

const paymentInput = z.object({
  amount: money,
  method: z.enum(['cash', 'card', 'transfer']),
  cashShiftId: z.string().uuid().nullable().optional(),
  externalReference: z.string().trim().max(128).nullable().optional(),
})

const refundInput = z.object({
  amount: money,
  reason: z.string().trim().min(1).max(500),
  cashShiftId: z.string().uuid().nullable().optional(),
})

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const requireKey = (req) => {
  const key = req.get('Idempotency-Key')
  if (!key || key.length > 128) {
    throw new ApiError({
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Требуется корректный Idempotency-Key',
    })
  }
  return key
}

export function createPaymentsRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const models = sequelize.models
  router.use(authenticate)

  const findOpenShift = async (id, organizationId, transaction) => {
    const shift = await models.CashShift.findOne({
      where: { id, organizationId, status: 'open' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    if (!shift) {
      throw new ApiError({
        status: 422,
        code: 'CASH_SHIFT_NOT_OPEN',
        message: 'Кассовая смена не открыта',
      })
    }
    return shift
  }

  router.post(
    '/cash-shifts',
    requirePermission('cash_shifts.manage'),
    requireBranchAccess((req) => req.body.branchId),
    async (req, res) => {
      const input = shiftOpenInput.parse(req.body)
      const shift = await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', {
          replacements: {
            key: `${req.auth.organizationId}:cash-shift:${input.workplaceId}`,
          },
          transaction,
        })
        const workplace = await models.Workplace.findOne({
          where: {
            id: input.workplaceId,
            organizationId: req.auth.organizationId,
            archivedAt: null,
          },
          include: [
            {
              model: models.Location,
              as: 'location',
              required: true,
              where: { branchId: input.branchId },
            },
          ],
          transaction,
        })
        if (!workplace) {
          throw new ApiError({
            status: 422,
            code: 'CASH_WORKPLACE_INVALID',
            message: 'Рабочее место недоступно',
          })
        }
        const existing = await models.CashShift.findOne({
          where: {
            organizationId: req.auth.organizationId,
            workplaceId: input.workplaceId,
            status: 'open',
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (existing) return existing
        return models.CashShift.create(
          {
            organizationId: req.auth.organizationId,
            branchId: input.branchId,
            workplaceId: input.workplaceId,
            openedByUserId: req.auth.userId,
            openedAt: new Date(),
            openingAmount: input.openingAmount,
            status: 'open',
            version: 0,
          },
          { transaction },
        )
      })
      res.status(201).json(success(shift, req.correlationId))
    },
  )

  router.get(
    '/cash-shifts/current',
    requirePermission('payments.create'),
    async (req, res) => {
      const input = currentShiftInput.parse(req.query)
      if (!req.auth.branchIds.includes(input.branchId)) {
        throw new ApiError({
          status: 403,
          code: 'AUTH_BRANCH_DENIED',
          message: 'Нет доступа к филиалу',
        })
      }
      const shift = await models.CashShift.findOne({
        where: {
          organizationId: req.auth.organizationId,
          branchId: input.branchId,
          status: 'open',
        },
        order: [['openedAt', 'DESC']],
      })
      res.json(success(shift, req.correlationId))
    },
  )

  router.post(
    '/cash-shifts/:id/close',
    requirePermission('cash_shifts.manage'),
    async (req, res) => {
      const shift = await sequelize.transaction(async (transaction) => {
        const current = await findOpenShift(
          req.params.id,
          req.auth.organizationId,
          transaction,
        )
        if (!req.auth.branchIds.includes(current.branchId)) {
          throw new ApiError({
            status: 404,
            code: 'CASH_SHIFT_NOT_FOUND',
            message: 'Кассовая смена не найдена',
          })
        }
        const transactions = await models.CashTransaction.findAll({
          where: { cashShiftId: current.id },
          transaction,
        })
        const movement = transactions.reduce(
          (total, row) =>
            row.type === 'refund'
              ? total - BigInt(row.amount)
              : total + BigInt(row.amount),
          0n,
        )
        const closingAmount = BigInt(current.openingAmount) + movement
        await current.update(
          {
            status: 'closed',
            closedByUserId: req.auth.userId,
            closedAt: new Date(),
            closingAmount: closingAmount.toString(),
            version: current.version + 1,
          },
          { transaction },
        )
        return current
      })
      res.json(success(shift, req.correlationId))
    },
  )

  router.post(
    '/orders/:orderId/payments',
    requirePermission('payments.create'),
    async (req, res) => {
      const input = paymentInput.parse(req.body)
      const idempotencyKey = requireKey(req)
      const payment = await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', {
          replacements: {
            key: `${req.auth.organizationId}:payment:${idempotencyKey}`,
          },
          transaction,
        })
        const existing = await models.Payment.findOne({
          where: { organizationId: req.auth.organizationId, idempotencyKey },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (existing) {
          if (
            existing.orderId !== req.params.orderId ||
            String(existing.amount) !== input.amount ||
            existing.method !== input.method
          ) {
            throw new ApiError({
              status: 409,
              code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: 'Ключ уже использован для другой оплаты',
            })
          }
          return existing
        }
        const order = await models.Order.findOne({
          where: { id: req.params.orderId, organizationId: req.auth.organizationId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (
          !order ||
          !req.auth.branchIds.includes(order.branchId) ||
          ['draft', 'cancelled'].includes(order.status)
        ) {
          throw new ApiError({
            status: 404,
            code: 'ORDER_NOT_FOUND',
            message: 'Заказ не найден',
          })
        }
        const outstanding = BigInt(order.totalAmount) - BigInt(order.paidAmount)
        if (BigInt(input.amount) > outstanding) {
          throw new ApiError({
            status: 422,
            code: 'PAYMENT_EXCEEDS_DEBT',
            message: 'Сумма оплаты превышает долг',
          })
        }
        let shift = null
        if (input.method === 'cash') {
          if (!input.cashShiftId) {
            throw new ApiError({
              status: 422,
              code: 'CASH_SHIFT_REQUIRED',
              message: 'Для наличной оплаты нужна кассовая смена',
            })
          }
          shift = await findOpenShift(
            input.cashShiftId,
            req.auth.organizationId,
            transaction,
          )
          if (shift.branchId !== order.branchId) {
            throw new ApiError({
              status: 422,
              code: 'CASH_SHIFT_BRANCH_MISMATCH',
              message: 'Кассовая смена открыта в другом филиале',
            })
          }
        }
        const created = await models.Payment.create(
          {
            organizationId: req.auth.organizationId,
            orderId: order.id,
            cashShiftId: shift?.id ?? null,
            idempotencyKey,
            amount: input.amount,
            method: input.method,
            status: 'confirmed',
            receivedByUserId: req.auth.userId,
            paidAt: new Date(),
            externalReference: input.externalReference ?? null,
          },
          { transaction },
        )
        if (shift) {
          await models.CashTransaction.create(
            {
              organizationId: req.auth.organizationId,
              cashShiftId: shift.id,
              paymentId: created.id,
              type: 'payment',
              amount: input.amount,
              occurredAt: new Date(),
              createdByUserId: req.auth.userId,
            },
            { transaction },
          )
        }
        await order.update(
          {
            paidAmount: (BigInt(order.paidAmount) + BigInt(input.amount)).toString(),
            version: order.version + 1,
          },
          { transaction },
        )
        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: 'payment.confirmed',
            entityType: 'Payment',
            entityId: created.id,
            correlationId: req.correlationId,
            after: { orderId: order.id, amount: input.amount, method: input.method },
            occurredAt: new Date(),
          },
          { transaction },
        )
        return created
      })
      res.status(201).json(success(payment, req.correlationId))
    },
  )

  router.post(
    '/payments/:paymentId/refunds',
    requirePermission('payments.refund'),
    async (req, res) => {
      const input = refundInput.parse(req.body)
      const idempotencyKey = requireKey(req)
      const refund = await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', {
          replacements: {
            key: `${req.auth.organizationId}:refund:${idempotencyKey}`,
          },
          transaction,
        })
        const existing = await models.Refund.findOne({
          where: { organizationId: req.auth.organizationId, idempotencyKey },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (existing) {
          if (
            existing.paymentId !== req.params.paymentId ||
            String(existing.amount) !== input.amount
          ) {
            throw new ApiError({
              status: 409,
              code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: 'Ключ уже использован для другого возврата',
            })
          }
          return existing
        }
        const payment = await models.Payment.findOne({
          where: {
            id: req.params.paymentId,
            organizationId: req.auth.organizationId,
            status: 'confirmed',
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!payment) {
          throw new ApiError({
            status: 404,
            code: 'PAYMENT_NOT_FOUND',
            message: 'Оплата не найдена',
          })
        }
        const order = await models.Order.findOne({
          where: { id: payment.orderId, organizationId: req.auth.organizationId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!order || !req.auth.branchIds.includes(order.branchId)) {
          throw new ApiError({
            status: 404,
            code: 'PAYMENT_NOT_FOUND',
            message: 'Оплата не найдена',
          })
        }
        const refunded = await models.Refund.sum('amount', {
          where: { paymentId: payment.id, status: 'confirmed' },
          transaction,
        })
        if (BigInt(input.amount) > BigInt(payment.amount) - BigInt(refunded || 0)) {
          throw new ApiError({
            status: 422,
            code: 'REFUND_EXCEEDS_PAYMENT',
            message: 'Сумма возврата превышает доступную',
          })
        }
        let shift = null
        if (payment.method === 'cash') {
          if (!input.cashShiftId) {
            throw new ApiError({
              status: 422,
              code: 'CASH_SHIFT_REQUIRED',
              message: 'Для наличного возврата нужна кассовая смена',
            })
          }
          shift = await findOpenShift(
            input.cashShiftId,
            req.auth.organizationId,
            transaction,
          )
          if (shift.branchId !== order.branchId) {
            throw new ApiError({
              status: 422,
              code: 'CASH_SHIFT_BRANCH_MISMATCH',
              message: 'Кассовая смена открыта в другом филиале',
            })
          }
        }
        const created = await models.Refund.create(
          {
            organizationId: req.auth.organizationId,
            paymentId: payment.id,
            idempotencyKey,
            amount: input.amount,
            status: 'confirmed',
            reason: input.reason,
            refundedByUserId: req.auth.userId,
            refundedAt: new Date(),
          },
          { transaction },
        )
        if (shift) {
          await models.CashTransaction.create(
            {
              organizationId: req.auth.organizationId,
              cashShiftId: shift.id,
              paymentId: payment.id,
              type: 'refund',
              amount: input.amount,
              occurredAt: new Date(),
              createdByUserId: req.auth.userId,
            },
            { transaction },
          )
        }
        await order.update(
          {
            paidAmount: (BigInt(order.paidAmount) - BigInt(input.amount)).toString(),
            version: order.version + 1,
          },
          { transaction },
        )
        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: 'refund.confirmed',
            entityType: 'Refund',
            entityId: created.id,
            correlationId: req.correlationId,
            after: { paymentId: payment.id, amount: input.amount, reason: input.reason },
            occurredAt: new Date(),
          },
          { transaction },
        )
        return created
      })
      res.status(201).json(success(refund, req.correlationId))
    },
  )

  return router
}
