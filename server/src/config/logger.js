import pino from 'pino'

export function createLogger({ level, environment }) {
  return pino({
    level,
    base: {
      environment,
      service: 'cleanflow-api',
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  })
}
