import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const transitionInput = z.object({
  stageId: z.string().uuid(),
  action: z.enum(['start', 'complete', 'rework']),
  workplaceId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

const assignInput = z.object({
  userId: z.string().uuid(),
  workplaceId: z.string().uuid().nullable().optional(),
})

const workStatusInput = z.object({
  status: z.enum(['in_progress', 'ready']),
})

const queueQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

const success = (data, correlationId, meta = {}) => ({
  data,
  meta: { correlationId, ...meta },
  error: null,
})

const workflowError = (code, message, status = 409) =>
  new ApiError({ status, code, message })

export function createProductionRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const models = sequelize.models
  router.use(authenticate)

  const loadItem = async (where, auth, options = {}) => {
    const item = await models.OrderItem.findOne({
      where: { ...where, organizationId: auth.organizationId },
      include: [{ model: models.Order, as: 'order', required: true }],
      ...options,
    })
    if (!item || !auth.branchIds.includes(item.order.branchId)) {
      throw workflowError('ORDER_ITEM_NOT_FOUND', 'Изделие не найдено', 404)
    }
    return item
  }

  const routeStages = (routeId, organizationId, transaction) =>
    models.ProductionRouteStage.findAll({
      where: { routeId, organizationId },
      include: [{ model: models.ProductionStage, as: 'stage', required: true }],
      order: [['position', 'ASC']],
      transaction,
    })

  const productionItemIncludes = (auth) => [
    {
      model: models.Order,
      as: 'order',
      required: true,
      where: { branchId: { [Op.in]: auth.branchIds } },
      attributes: ['id', 'displayNumber', 'branchId', 'dueAt', 'status'],
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
    {
      model: models.ItemStageHistory,
      as: 'stageHistory',
    },
  ]

  router.get(
    '/production/routes',
    requirePermission('production.view'),
    async (req, res) => {
      const routes = await models.ProductionRoute.findAll({
        where: {
          organizationId: req.auth.organizationId,
          archivedAt: null,
        },
        include: [
          {
            model: models.ProductionRouteStage,
            as: 'stages',
            include: [{ model: models.ProductionStage, as: 'stage' }],
          },
        ],
        order: [
          ['name', 'ASC'],
          [{ model: models.ProductionRouteStage, as: 'stages' }, 'position', 'ASC'],
        ],
      })
      res.json(success(routes, req.correlationId))
    },
  )

  router.get(
    '/production/items',
    requirePermission('production.view'),
    async (req, res) => {
      const input = queueQuery.parse(req.query)
      const where = {
        organizationId: req.auth.organizationId,
        status: input.status || {
          [Op.notIn]: ['draft', 'issued', 'rejected', 'cancelled'],
        },
      }
      if (input.search) {
        where[Op.or] = [
          { scanCode: { [Op.iLike]: `%${input.search}%` } },
          { description: { [Op.iLike]: `%${input.search}%` } },
          { '$order.displayNumber$': { [Op.iLike]: `%${input.search}%` } },
          { '$order.client.fullName$': { [Op.iLike]: `%${input.search}%` } },
          { '$order.client.phone$': { [Op.iLike]: `%${input.search}%` } },
          { '$nomenclature.name$': { [Op.iLike]: `%${input.search}%` } },
          { '$garmentType.name$': { [Op.iLike]: `%${input.search}%` } },
        ]
      }
      const result = await models.OrderItem.findAndCountAll({
        where,
        include: productionItemIncludes(req.auth),
        order: [
          [{ model: models.Order, as: 'order' }, 'dueAt', 'ASC'],
          ['createdAt', 'ASC'],
        ],
        limit: input.limit,
        distinct: true,
        subQuery: false,
      })
      res.json(
        success(result.rows, req.correlationId, {
          total: result.count,
          limit: input.limit,
        }),
      )
    },
  )

  router.get(
    '/production/items/scan/:scanCode',
    requirePermission('production.view'),
    async (req, res) => {
      const item = await loadItem({ scanCode: req.params.scanCode }, req.auth, {
        include: productionItemIncludes(req.auth),
      })
      res.json(success(item, req.correlationId))
    },
  )

  router.patch(
    '/order-items/:itemId/work-status',
    requirePermission('production.transition'),
    async (req, res) => {
      const input = workStatusInput.parse(req.body)
      const result = await sequelize.transaction(async (transaction) => {
        const item = await loadItem({ id: req.params.itemId }, req.auth, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (
          ['draft', 'cancelled', 'issued'].includes(item.order.status) ||
          ['cancelled', 'issued', 'rejected'].includes(item.status)
        ) {
          throw workflowError(
            'ITEM_STATUS_LOCKED',
            'Статус отменённого или выданного изделия изменить нельзя',
          )
        }

        const previousItemStatus = item.status
        if (previousItemStatus !== input.status) {
          await item.update(
            {
              status: input.status,
              version: item.version + 1,
            },
            { transaction },
          )
        }

        const siblings = await models.OrderItem.findAll({
          where: {
            orderId: item.orderId,
            organizationId: req.auth.organizationId,
          },
          transaction,
        })
        const hasIssuedItems = siblings.some((sibling) => sibling.status === 'issued')
        const remainingItems = siblings.filter((sibling) => sibling.status !== 'issued')
        let orderStatus
        if (hasIssuedItems) {
          orderStatus = 'partially_issued'
        } else if (remainingItems.every((sibling) => sibling.status === 'ready')) {
          orderStatus = 'ready'
        } else if (remainingItems.some((sibling) => sibling.status === 'ready')) {
          orderStatus = 'partially_ready'
        } else {
          orderStatus = 'in_progress'
        }

        const previousOrderStatus = item.order.status
        if (previousOrderStatus !== orderStatus) {
          await item.order.update(
            {
              status: orderStatus,
              version: item.order.version + 1,
            },
            { transaction },
          )
          await models.OrderStatusHistory.create(
            {
              organizationId: req.auth.organizationId,
              orderId: item.order.id,
              fromStatus: previousOrderStatus,
              toStatus: orderStatus,
              changedByUserId: req.auth.userId,
              reason: 'Быстрое изменение статуса позиции из заказа',
              changedAt: new Date(),
            },
            { transaction },
          )
        }

        if (previousItemStatus !== input.status) {
          await models.AuditLog.create(
            {
              organizationId: req.auth.organizationId,
              actorUserId: req.auth.userId,
              action: 'production.work_status_update',
              entityType: 'OrderItem',
              entityId: item.id,
              correlationId: req.correlationId,
              before: { status: previousItemStatus },
              after: { status: item.status, orderStatus },
              occurredAt: new Date(),
            },
            { transaction },
          )
          await models.OutboxEvent.create(
            {
              organizationId: req.auth.organizationId,
              aggregateType: 'OrderItem',
              aggregateId: item.id,
              type: 'production.work_status_updated',
              payload: {
                orderItemId: item.id,
                fromStatus: previousItemStatus,
                toStatus: item.status,
                orderStatus,
              },
              occurredAt: new Date(),
            },
            { transaction },
          )
        }

        if (previousOrderStatus !== 'ready' && orderStatus === 'ready') {
          await models.Notification.create(
            {
              organizationId: req.auth.organizationId,
              clientId: item.order.clientId,
              type: 'order_ready',
              channel: 'internal',
              status: 'pending',
              payload: {
                orderId: item.order.id,
                displayNumber: item.order.displayNumber,
              },
            },
            { transaction },
          )
        }

        return {
          item,
          order: {
            id: item.order.id,
            status: orderStatus,
            version: item.order.version,
          },
        }
      })
      res.json(success(result, req.correlationId))
    },
  )

  router.post(
    '/order-items/:itemId/transition',
    requirePermission('production.transition'),
    async (req, res) => {
      const input = transitionInput.parse(req.body)
      const result = await sequelize.transaction(async (transaction) => {
        const item = await loadItem({ id: req.params.itemId }, req.auth, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!item.routeId || ['issued', 'rejected'].includes(item.status)) {
          throw workflowError('ITEM_ROUTE_UNAVAILABLE', 'Маршрут изделия недоступен')
        }
        const stages = await routeStages(
          item.routeId,
          req.auth.organizationId,
          transaction,
        )
        const targetIndex = stages.findIndex(({ stageId }) => stageId === input.stageId)
        if (targetIndex < 0) {
          throw workflowError('ITEM_STAGE_NOT_IN_ROUTE', 'Этап не входит в маршрут')
        }
        const latest = await models.ItemStageHistory.findOne({
          where: { orderItemId: item.id, organizationId: req.auth.organizationId },
          order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
          ],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })

        if (input.action === 'start') {
          if (latest?.status === 'in_progress') {
            throw workflowError('ITEM_STAGE_ALREADY_STARTED', 'Этап уже начат')
          }
          let expectedIndex = 0
          if (latest?.status === 'completed') {
            expectedIndex =
              stages.findIndex(({ stageId }) => stageId === latest.stageId) + 1
          } else if (latest?.status === 'rework') {
            const qualityIndex = stages.findIndex(
              ({ stage }) => stage.code === 'QUALITY_CONTROL',
            )
            if (targetIndex >= qualityIndex || qualityIndex < 0) {
              throw workflowError(
                'ITEM_REWORK_STAGE_INVALID',
                'Доработка должна вернуться на этап до контроля качества',
              )
            }
            expectedIndex = targetIndex
          }
          if (targetIndex !== expectedIndex || expectedIndex >= stages.length) {
            throw workflowError('ITEM_STAGE_OUT_OF_SEQUENCE', 'Нарушена очередь этапов')
          }
          if (input.workplaceId) {
            const workplace = await models.Workplace.findOne({
              where: {
                id: input.workplaceId,
                organizationId: req.auth.organizationId,
                archivedAt: null,
              },
              transaction,
            })
            if (!workplace) {
              throw workflowError(
                'PRODUCTION_WORKPLACE_INVALID',
                'Рабочее место недоступно',
                422,
              )
            }
          }
          const history = await models.ItemStageHistory.create(
            {
              organizationId: req.auth.organizationId,
              orderItemId: item.id,
              stageId: input.stageId,
              status: 'in_progress',
              workplaceId: input.workplaceId ?? null,
              assignedUserId: null,
              startedAt: new Date(),
              notes: input.notes ?? null,
            },
            { transaction },
          )
          await item.update(
            {
              status: stages[targetIndex].stage.code.toLowerCase(),
              version: item.version + 1,
            },
            { transaction },
          )
          await models.AuditLog.create(
            {
              organizationId: req.auth.organizationId,
              actorUserId: req.auth.userId,
              action: 'production.start',
              entityType: 'OrderItem',
              entityId: item.id,
              correlationId: req.correlationId,
              after: { stageId: input.stageId, status: item.status },
              occurredAt: new Date(),
            },
            { transaction },
          )
          await models.OutboxEvent.create(
            {
              organizationId: req.auth.organizationId,
              aggregateType: 'OrderItem',
              aggregateId: item.id,
              type: 'production.start',
              payload: { orderItemId: item.id, stageId: input.stageId },
              occurredAt: new Date(),
            },
            { transaction },
          )
          return { item, history }
        }

        if (
          !latest ||
          latest.status !== 'in_progress' ||
          latest.stageId !== input.stageId
        ) {
          throw workflowError('ITEM_STAGE_NOT_ACTIVE', 'Этап не активен')
        }
        const stage = stages[targetIndex]
        if (input.action === 'rework') {
          if (!req.auth.permissions.includes('production.quality_control')) {
            throw new ApiError({
              status: 403,
              code: 'AUTH_PERMISSION_DENIED',
              message: 'Недостаточно прав для контроля качества',
            })
          }
          if (stage.stage.code !== 'QUALITY_CONTROL') {
            throw workflowError(
              'ITEM_REWORK_NOT_ALLOWED',
              'Доработку назначает контроль качества',
            )
          }
          await latest.update(
            { status: 'rework', completedAt: new Date(), notes: input.notes ?? null },
            { transaction },
          )
          await item.update(
            { status: 'rework', version: item.version + 1 },
            { transaction },
          )
        } else {
          await latest.update(
            { status: 'completed', completedAt: new Date(), notes: input.notes ?? null },
            { transaction },
          )
          const ready = targetIndex === stages.length - 1
          await item.update(
            {
              status: ready ? 'ready' : stage.stage.code.toLowerCase(),
              version: item.version + 1,
            },
            { transaction },
          )
          if (ready) {
            const siblings = await models.OrderItem.findAll({
              where: { orderId: item.orderId, organizationId: req.auth.organizationId },
              transaction,
            })
            const readyCount = siblings.filter(
              (sibling) => sibling.id === item.id || sibling.status === 'ready',
            ).length
            const orderStatus =
              readyCount === siblings.length ? 'ready' : 'partially_ready'
            const order = await models.Order.findByPk(item.orderId, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            })
            const fromStatus = order.status
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
                changedAt: new Date(),
              },
              { transaction },
            )
            if (orderStatus === 'ready') {
              await models.Notification.create(
                {
                  organizationId: req.auth.organizationId,
                  clientId: order.clientId,
                  type: 'order_ready',
                  channel: 'internal',
                  status: 'pending',
                  payload: {
                    orderId: order.id,
                    displayNumber: order.displayNumber,
                  },
                },
                { transaction },
              )
            }
          }
        }

        await models.AuditLog.create(
          {
            organizationId: req.auth.organizationId,
            actorUserId: req.auth.userId,
            action: `production.${input.action}`,
            entityType: 'OrderItem',
            entityId: item.id,
            correlationId: req.correlationId,
            after: { stageId: input.stageId, status: item.status },
            occurredAt: new Date(),
          },
          { transaction },
        )
        await models.OutboxEvent.create(
          {
            organizationId: req.auth.organizationId,
            aggregateType: 'OrderItem',
            aggregateId: item.id,
            type: `production.${input.action}`,
            payload: { orderItemId: item.id, stageId: input.stageId },
            occurredAt: new Date(),
          },
          { transaction },
        )
        return { item, history: latest }
      })
      res.json(success(result, req.correlationId))
    },
  )

  router.post(
    '/order-items/:itemId/assign',
    requirePermission('production.assign'),
    async (req, res) => {
      const input = assignInput.parse(req.body)
      const history = await sequelize.transaction(async (transaction) => {
        const item = await loadItem({ id: req.params.itemId }, req.auth, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        const user = await models.User.findOne({
          where: {
            id: input.userId,
            organizationId: req.auth.organizationId,
            status: 'active',
          },
          transaction,
        })
        const userBranch = await models.UserBranch.findOne({
          where: { userId: input.userId, branchId: item.order.branchId },
          transaction,
        })
        const active = await models.ItemStageHistory.findOne({
          where: {
            orderItemId: item.id,
            organizationId: req.auth.organizationId,
            status: 'in_progress',
          },
          order: [['createdAt', 'DESC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
        if (!user || !userBranch || !active) {
          throw workflowError(
            'PRODUCTION_ASSIGNMENT_INVALID',
            'Исполнитель или активный этап недоступны',
            422,
          )
        }
        if (input.workplaceId) {
          const workplace = await models.Workplace.findOne({
            where: {
              id: input.workplaceId,
              organizationId: req.auth.organizationId,
              archivedAt: null,
            },
            transaction,
          })
          if (!workplace) {
            throw workflowError(
              'PRODUCTION_WORKPLACE_INVALID',
              'Рабочее место недоступно',
              422,
            )
          }
        }
        await active.update(
          {
            assignedUserId: user.id,
            workplaceId: input.workplaceId ?? active.workplaceId,
          },
          { transaction },
        )
        return active
      })
      res.json(success(history, req.correlationId))
    },
  )

  return router
}
