import { Op } from 'sequelize'
import { Router } from 'express'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'
import {
  addressCreateSchema,
  clientCreateSchema,
  clientListSchema,
  clientUpdateSchema,
  consentCreateSchema,
} from './clients.validation.js'

const success = (data, correlationId, meta = {}) => ({
  data,
  meta: { correlationId, ...meta },
  error: null,
})

export function createClientsRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const { Client, ClientAddress, ClientConsent } = sequelize.models

  const findClient = async (id, organizationId, options = {}) => {
    const client = await Client.findOne({
      where: { id, organizationId, archivedAt: null },
      ...options,
    })
    if (!client) {
      throw new ApiError({
        status: 404,
        code: 'CLIENT_NOT_FOUND',
        message: 'Клиент не найден',
      })
    }
    return client
  }

  router.use(authenticate)

  router.get('/', requirePermission('clients.view'), async (req, res) => {
    const query = clientListSchema.parse(req.query)
    const search = query.search
      ? {
          [Op.or]: [
            { fullName: { [Op.iLike]: `%${query.search}%` } },
            { phone: { [Op.iLike]: `%${query.search}%` } },
            { email: { [Op.iLike]: `%${query.search}%` } },
          ],
        }
      : {}
    const { rows, count } = await Client.findAndCountAll({
      where: {
        organizationId: req.auth.organizationId,
        archivedAt: null,
        ...search,
      },
      order: [
        ['fullName', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    res.json(
      success(rows, req.correlationId, {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
      }),
    )
  })

  router.post('/', requirePermission('clients.create'), async (req, res) => {
    const input = clientCreateSchema.parse(req.body)
    const client = await Client.create({
      organizationId: req.auth.organizationId,
      ...input,
      version: 0,
    })
    res.status(201).json(success(client, req.correlationId))
  })

  router.get('/:id', requirePermission('clients.view'), async (req, res) => {
    const client = await findClient(req.params.id, req.auth.organizationId, {
      include: [
        { model: ClientAddress, as: 'addresses' },
        { model: ClientConsent, as: 'consents' },
      ],
    })
    res.json(success(client, req.correlationId))
  })

  router.patch('/:id', requirePermission('clients.update'), async (req, res) => {
    const input = clientUpdateSchema.parse(req.body)
    const client = await findClient(req.params.id, req.auth.organizationId)
    await client.update({ ...input, version: client.version + 1 })
    res.json(success(client, req.correlationId))
  })

  router.delete('/:id', requirePermission('clients.update'), async (req, res) => {
    const client = await findClient(req.params.id, req.auth.organizationId)
    await client.update({ archivedAt: new Date(), version: client.version + 1 })
    res.json(success({ archived: true }, req.correlationId))
  })

  router.post('/:id/addresses', requirePermission('clients.update'), async (req, res) => {
    const input = addressCreateSchema.parse(req.body)
    const client = await findClient(req.params.id, req.auth.organizationId)
    const address = await sequelize.transaction(async (transaction) => {
      if (input.isPrimary) {
        await ClientAddress.update(
          { isPrimary: false },
          { where: { clientId: client.id }, transaction },
        )
      }
      return ClientAddress.create(
        {
          organizationId: req.auth.organizationId,
          clientId: client.id,
          ...input,
        },
        { transaction },
      )
    })
    res.status(201).json(success(address, req.correlationId))
  })

  router.post('/:id/consents', requirePermission('clients.update'), async (req, res) => {
    const input = consentCreateSchema.parse(req.body)
    const client = await findClient(req.params.id, req.auth.organizationId)
    const consent = await ClientConsent.create({
      organizationId: req.auth.organizationId,
      clientId: client.id,
      acceptedByUserId: req.auth.userId,
      acceptedAt: new Date(),
      ...input,
    })
    res.status(201).json(success(consent, req.correlationId))
  })

  return router
}
