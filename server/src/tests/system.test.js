import pino from 'pino'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../app.js'

function buildApp(readyCheck = vi.fn().mockResolvedValue(undefined)) {
  return createApp({
    environment: 'test',
    logger: pino({ level: 'silent' }),
    readyCheck,
  })
}

describe('system endpoints', () => {
  it('reports process health in the standard envelope', async () => {
    const response = await request(buildApp()).get('/api/v1/health').expect(200)

    expect(response.body).toMatchObject({
      data: {
        environment: 'test',
        service: 'cleanflow-api',
        status: 'ok',
      },
      error: null,
    })
    expect(response.body.meta.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i)
    expect(response.headers['x-correlation-id']).toBe(response.body.meta.correlationId)
  })

  it('reports readiness when the database check succeeds', async () => {
    const readyCheck = vi.fn().mockResolvedValue(undefined)
    const response = await request(buildApp(readyCheck)).get('/api/v1/ready').expect(200)

    expect(readyCheck).toHaveBeenCalledOnce()
    expect(response.body.data).toMatchObject({
      database: 'available',
      status: 'ready',
    })
  })

  it('returns 503 without leaking database details when readiness fails', async () => {
    const readyCheck = vi.fn().mockRejectedValue(new Error('secret database host'))
    const response = await request(buildApp(readyCheck)).get('/api/v1/ready').expect(503)

    expect(response.body.error).toEqual({
      code: 'SERVICE_NOT_READY',
      message: 'Сервис временно не готов',
      details: [],
    })
    expect(JSON.stringify(response.body)).not.toContain('secret database host')
  })

  it('uses the standard error envelope for unknown routes', async () => {
    const response = await request(buildApp()).get('/api/v1/missing').expect(404)

    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND')
    expect(response.body.meta.correlationId).toBeTruthy()
  })
})
