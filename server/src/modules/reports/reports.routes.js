import { Router } from 'express'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { createAuthService } from '../auth/auth.service.js'

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const csv = (rows) => {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [
    columns.map(escape).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\r\n')
}

export function createReportsRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const models = sequelize.models
  router.use(authenticate)

  router.get(
    '/reports/operational',
    requirePermission('reports.operational'),
    async (req, res) => {
      const orders = await models.Order.findAll({
        where: {
          organizationId: req.auth.organizationId,
          branchId: req.auth.branchIds,
        },
        attributes: ['id', 'displayNumber', 'branchId', 'status', 'createdAt'],
        order: [['createdAt', 'DESC']],
      })
      const byStatus = Object.fromEntries(
        [...new Set(orders.map(({ status }) => status))].map((status) => [
          status,
          orders.filter((order) => order.status === status).length,
        ]),
      )
      if (req.query.format === 'csv') {
        res
          .set('Content-Disposition', 'attachment; filename="operational-report.csv"')
          .type('text/csv')
          .send(
            `\uFEFF${csv(
              orders.map((order) => ({
                number: order.displayNumber,
                branchId: order.branchId,
                status: order.status,
                createdAt: order.createdAt.toISOString(),
              })),
            )}`,
          )
        return
      }
      res.json(success({ totalOrders: orders.length, byStatus }, req.correlationId))
    },
  )

  router.get(
    '/reports/financial',
    requirePermission('reports.financial'),
    async (req, res) => {
      const payments = await models.Payment.findAll({
        where: { organizationId: req.auth.organizationId, status: 'confirmed' },
        attributes: ['id', 'orderId', 'amount', 'method', 'paidAt'],
        order: [['paidAt', 'DESC']],
      })
      const refunds = await models.Refund.findAll({
        where: { organizationId: req.auth.organizationId, status: 'confirmed' },
        attributes: ['id', 'paymentId', 'amount', 'refundedAt'],
      })
      const paid = payments.reduce((sum, row) => sum + BigInt(row.amount), 0n)
      const refunded = refunds.reduce((sum, row) => sum + BigInt(row.amount), 0n)
      if (req.query.format === 'csv') {
        res
          .set('Content-Disposition', 'attachment; filename="financial-report.csv"')
          .type('text/csv')
          .send(
            `\uFEFF${csv(
              payments.map((payment) => ({
                paymentId: payment.id,
                orderId: payment.orderId,
                amount: payment.amount,
                method: payment.method,
                paidAt: payment.paidAt.toISOString(),
              })),
            )}`,
          )
        return
      }
      res.json(
        success(
          {
            paidAmount: paid.toString(),
            refundedAmount: refunded.toString(),
            netAmount: (paid - refunded).toString(),
            paymentCount: payments.length,
            refundCount: refunds.length,
          },
          req.correlationId,
        ),
      )
    },
  )

  router.get('/audit', requirePermission('audit.view'), async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
    const rows = await models.AuditLog.findAll({
      where: { organizationId: req.auth.organizationId },
      order: [['occurredAt', 'DESC']],
      limit,
    })
    res.json(success(rows, req.correlationId))
  })

  router.get('/notifications', async (req, res) => {
    const rows = await models.Notification.findAll({
      where: { organizationId: req.auth.organizationId },
      order: [['createdAt', 'DESC']],
      limit: 100,
    })
    res.json(success(rows, req.correlationId))
  })

  return router
}
