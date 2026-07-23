import express from 'express'
import pinoHttp from 'pino-http'

import { correlationId } from './middlewares/correlation-id.js'
import { errorHandler } from './middlewares/error-handler.js'
import { notFound } from './middlewares/not-found.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import {
  createCatalogRouter,
  createServicesRouter,
} from './modules/catalog/catalog.routes.js'
import { createClientsRouter } from './modules/clients/clients.routes.js'
import { createPriceListsRouter } from './modules/price-lists/price-lists.routes.js'
import { createOrdersRouter } from './modules/orders/orders.routes.js'
import { createFilesRouter } from './modules/files/files.routes.js'
import { createPaymentsRouter } from './modules/payments/payments.routes.js'
import { createProductionRouter } from './modules/production/production.routes.js'
import { createIssuesRouter } from './modules/issues/issues.routes.js'
import { createNomenclatureRouter } from './modules/nomenclature/nomenclature.routes.js'
import { createReportsRouter } from './modules/reports/reports.routes.js'
import { createSystemRouter } from './modules/system/system.routes.js'

export function createApp({ environment, logger, readyCheck, sequelize, env }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(correlationId)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.correlationId,
      customLogLevel(_req, res, error) {
        if (error || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use(
    '/api/v1',
    createSystemRouter({
      environment,
      readyCheck,
    }),
  )
  if (sequelize && env) {
    app.use('/api/v1/auth', createAuthRouter({ sequelize, env }))
    app.use('/api/v1/clients', createClientsRouter({ sequelize, env }))
    app.use('/api/v1/catalog', createCatalogRouter({ sequelize, env }))
    app.use(
      '/api/v1/nomenclature',
      createNomenclatureRouter({ sequelize, env }),
    )
    app.use('/api/v1/services', createServicesRouter({ sequelize, env }))
    app.use('/api/v1/price-lists', createPriceListsRouter({ sequelize, env }))
    const ordersRouter = createOrdersRouter({ sequelize, env })
    app.use('/api/v1/orders', ordersRouter)
    app.use('/api/v1/order-items', (req, res, next) => {
      const originalUrl = req.url
      req.url = `/items${req.url}`
      ordersRouter(req, res, (error) => {
        req.url = originalUrl
        next(error)
      })
    })
    app.use('/api/v1/files', createFilesRouter({ sequelize, env }))
    app.use('/api/v1', createPaymentsRouter({ sequelize, env }))
    app.use('/api/v1', createProductionRouter({ sequelize, env }))
    app.use('/api/v1', createIssuesRouter({ sequelize, env }))
    app.use('/api/v1', createReportsRouter({ sequelize, env }))
  }

  app.use(notFound)
  app.use(errorHandler)

  return app
}
