import { createServer } from 'node:http'

import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { createLogger } from './config/logger.js'
import { createSequelize } from './database/sequelize.js'

const env = parseEnv()
const logger = createLogger({
  environment: env.NODE_ENV,
  level: env.LOG_LEVEL,
})
const sequelize = createSequelize(env, logger)
const app = createApp({
  environment: env.NODE_ENV,
  logger,
  readyCheck: () => sequelize.authenticate(),
  sequelize,
  env,
})
const server = createServer(app)

server.listen(env.SERVER_PORT, env.HOST, () => {
  logger.info(
    {
      host: env.HOST,
      port: env.SERVER_PORT,
    },
    'cleanflow api started',
  )
})

async function shutdown(signal) {
  logger.info({ signal }, 'shutdown started')

  server.close(async (serverError) => {
    try {
      await sequelize.close()
    } catch (databaseError) {
      logger.error({ err: databaseError }, 'database shutdown failed')
    }

    if (serverError) {
      logger.error({ err: serverError }, 'http shutdown failed')
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
