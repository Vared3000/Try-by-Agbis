import { Router } from 'express'

function success(data, correlationId) {
  return {
    data,
    meta: {
      correlationId,
    },
    error: null,
  }
}

export function createSystemRouter({ environment, readyCheck }) {
  const router = Router()

  router.get('/health', (req, res) => {
    res.json(
      success(
        {
          environment,
          service: 'cleanflow-api',
          status: 'ok',
        },
        req.correlationId,
      ),
    )
  })

  router.get('/ready', async (req, res) => {
    try {
      await readyCheck()
      res.json(
        success(
          {
            database: 'available',
            service: 'cleanflow-api',
            status: 'ready',
          },
          req.correlationId,
        ),
      )
    } catch (error) {
      req.log.warn({ err: error }, 'readiness check failed')
      res.status(503).json({
        data: null,
        meta: {
          correlationId: req.correlationId,
        },
        error: {
          code: 'SERVICE_NOT_READY',
          message: 'Сервис временно не готов',
          details: [],
        },
      })
    }
  })

  return router
}
