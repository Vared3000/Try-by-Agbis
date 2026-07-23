import { ZodError } from 'zod'
import { UniqueConstraintError } from 'sequelize'

import { ApiError } from '../shared/api-error.js'

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      data: null,
      meta: { correlationId: req.correlationId },
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      data: null,
      meta: { correlationId: req.correlationId },
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Некорректные данные запроса',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
    return
  }

  if (error instanceof UniqueConstraintError) {
    res.status(409).json({
      data: null,
      meta: { correlationId: req.correlationId },
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'Такая запись уже существует',
        details: error.errors.map(({ path }) => ({ field: path })),
      },
    })
    return
  }

  req.log.error({ err: error }, 'unhandled request error')

  res.status(500).json({
    data: null,
    meta: {
      correlationId: req.correlationId,
    },
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Внутренняя ошибка сервера',
      details: [],
    },
  })
}
