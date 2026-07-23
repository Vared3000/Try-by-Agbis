import { randomUUID } from 'node:crypto'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function correlationId(req, res, next) {
  const incomingId = req.get('x-correlation-id')
  req.correlationId =
    typeof incomingId === 'string' && UUID_PATTERN.test(incomingId)
      ? incomingId
      : randomUUID()
  res.set('X-Correlation-Id', req.correlationId)
  next()
}
