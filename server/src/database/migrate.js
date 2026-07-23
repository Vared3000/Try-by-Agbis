import { DataTypes } from 'sequelize'

import { parseEnv } from '../config/env.js'
import { createLogger } from '../config/logger.js'
import { migrations } from './migrations/index.js'
import { createSequelize } from './sequelize.js'

const migrationTable = 'sequelize_migrations'

async function ensureMigrationTable(queryInterface) {
  const tables = await queryInterface.showAllTables()
  if (tables.includes(migrationTable)) return

  await queryInterface.createTable(migrationTable, {
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true,
    },
    appliedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  })
}

async function appliedMigrationNames(sequelize) {
  const [rows] = await sequelize.query(
    `SELECT "name" FROM "${migrationTable}" ORDER BY "name"`,
  )
  return new Set(rows.map((row) => row.name))
}

export async function migrate(sequelize, logger) {
  const queryInterface = sequelize.getQueryInterface()
  await ensureMigrationTable(queryInterface)
  const applied = await appliedMigrationNames(sequelize)

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue

    await sequelize.transaction(async (transaction) => {
      await migration.up({ queryInterface, transaction })
      await queryInterface.bulkInsert(
        migrationTable,
        [{ name: migration.name, appliedAt: new Date() }],
        { transaction },
      )
    })
    logger.info({ migration: migration.name }, 'database migration applied')
  }
}

export async function rollback(sequelize, logger) {
  const queryInterface = sequelize.getQueryInterface()
  await ensureMigrationTable(queryInterface)
  const applied = await appliedMigrationNames(sequelize)
  const migration = [...migrations]
    .reverse()
    .find((candidate) => applied.has(candidate.name))

  if (!migration) {
    logger.info('no database migration to roll back')
    return
  }

  await sequelize.transaction(async (transaction) => {
    await migration.down({ queryInterface, transaction })
    await queryInterface.bulkDelete(
      migrationTable,
      { name: migration.name },
      { transaction },
    )
  })
  logger.info({ migration: migration.name }, 'database migration rolled back')
}

async function main() {
  const command = process.argv[2] ?? 'up'
  if (!['up', 'down'].includes(command)) {
    throw new Error('Usage: node src/database/migrate.js [up|down]')
  }

  const env = parseEnv()
  const logger = createLogger({ environment: env.NODE_ENV, level: env.LOG_LEVEL })
  const sequelize = createSequelize(env, logger)

  try {
    await sequelize.authenticate()
    if (command === 'up') await migrate(sequelize, logger)
    else await rollback(sequelize, logger)
  } finally {
    await sequelize.close()
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href
) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
