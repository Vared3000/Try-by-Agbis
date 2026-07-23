import { Sequelize } from 'sequelize'

import { initializeModels } from './models/index.js'

export function createSequelize(env, logger) {
  const sequelize = new Sequelize(env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: env.DATABASE_SSL
      ? {
          ssl: {
            rejectUnauthorized: true,
          },
        }
      : {},
    logging: (sql) => logger.debug({ sql }, 'database query'),
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
    },
  })

  initializeModels(sequelize)
  return sequelize
}
