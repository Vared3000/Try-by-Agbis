import { randomUUID } from 'node:crypto'

import { DataTypes } from 'sequelize'

export const name = '202607240009-order-number-format'

const newOrderIndex = 'orders_organization_id_branch_id_sequence'
const legacyOrderIndexes = [
  'orders_organization_id_acceptance_location_id_sequence',
  'orders_organization_id_acceptance_location_id_accepted_on_sequence',
]
const branchNumberIndex = 'branches_organization_number_unique'
const sequenceIndex = 'number_sequences_organization_branch_unique'

const createBranchSequencesTable = async (queryInterface, transaction) => {
  await queryInterface.createTable(
    'number_sequences',
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
      },
      branchId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'branches', key: 'id' },
      },
      nextValue: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 1 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { transaction },
  )
  await queryInterface.addIndex(
    'number_sequences',
    ['organizationId', 'branchId'],
    {
      name: sequenceIndex,
      unique: true,
      transaction,
    },
  )
}

const createLegacySequencesTable = async (queryInterface, transaction) => {
  await queryInterface.createTable(
    'number_sequences',
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
      },
      acceptanceLocationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
      },
      businessDate: { type: DataTypes.DATEONLY, allowNull: false },
      nextValue: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 1 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { transaction },
  )
  await queryInterface.addIndex(
    'number_sequences',
    ['organizationId', 'acceptanceLocationId', 'businessDate'],
    { unique: true, transaction },
  )
}

export async function up({ queryInterface, transaction }) {
  const branchColumns = await queryInterface.describeTable('branches')
  if (!branchColumns.number) {
    await queryInterface.addColumn(
      'branches',
      'number',
      { type: DataTypes.INTEGER, allowNull: true },
      { transaction },
    )
  }
  await queryInterface.sequelize.query(
    `WITH numbered AS (
       SELECT "id",
              ROW_NUMBER() OVER (
                PARTITION BY "organizationId"
                ORDER BY "createdAt", "id"
              ) AS branch_number
         FROM "branches"
     )
     UPDATE "branches" AS branch
        SET "number" = numbered.branch_number
       FROM numbered
      WHERE branch."id" = numbered."id"
        AND branch."number" IS NULL`,
    { transaction },
  )
  await queryInterface.changeColumn(
    'branches',
    'number',
    { type: DataTypes.INTEGER, allowNull: false },
    { transaction },
  )
  const branchIndexes = await queryInterface.showIndex('branches', { transaction })
  if (!branchIndexes.some(({ name }) => name === branchNumberIndex)) {
    await queryInterface.addIndex('branches', ['organizationId', 'number'], {
      name: branchNumberIndex,
      unique: true,
      transaction,
    })
  }

  await queryInterface.sequelize.query(
    `WITH ranked AS (
       SELECT orders."id",
              ROW_NUMBER() OVER (
                PARTITION BY orders."organizationId", orders."branchId"
                ORDER BY orders."createdAt", orders."id"
              ) AS order_number,
              branches."number" AS branch_number
         FROM "orders" AS orders
         JOIN "branches" AS branches ON branches."id" = orders."branchId"
     )
     UPDATE "orders" AS orders
        SET "sequence" = ranked.order_number,
            "displayNumber" =
              LPAD(ranked.order_number::text, 6, '0') || '-' || ranked.branch_number::text
       FROM ranked
      WHERE orders."id" = ranked."id"`,
    { transaction },
  )

  const orderIndexes = await queryInterface.showIndex('orders', { transaction })
  for (const indexName of legacyOrderIndexes) {
    if (orderIndexes.some(({ name }) => name === indexName)) {
      await queryInterface.removeIndex('orders', indexName, { transaction })
    }
  }
  if (!orderIndexes.some(({ name }) => name === newOrderIndex)) {
    await queryInterface.addIndex(
      'orders',
      ['organizationId', 'branchId', 'sequence'],
      { name: newOrderIndex, unique: true, transaction },
    )
  }

  const sequenceColumns = await queryInterface.describeTable('number_sequences')
  if (!sequenceColumns.branchId) {
    await queryInterface.dropTable('number_sequences', { transaction })
    await createBranchSequencesTable(queryInterface, transaction)
  } else {
    await queryInterface.bulkDelete('number_sequences', {}, { transaction })
  }

  const [nextValues] = await queryInterface.sequelize.query(
    `SELECT "organizationId", "branchId", MAX("sequence")::bigint + 1 AS "nextValue"
       FROM "orders"
      GROUP BY "organizationId", "branchId"`,
    { transaction },
  )
  if (nextValues.length) {
    const now = new Date()
    await queryInterface.bulkInsert(
      'number_sequences',
      nextValues.map((row) => ({
        id: randomUUID(),
        organizationId: row.organizationId,
        branchId: row.branchId,
        nextValue: row.nextValue,
        createdAt: now,
        updatedAt: now,
      })),
      { transaction },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  const orderIndexes = await queryInterface.showIndex('orders', { transaction })
  if (orderIndexes.some(({ name }) => name === newOrderIndex)) {
    await queryInterface.removeIndex('orders', newOrderIndex, { transaction })
  }
  if (!orderIndexes.some(({ name }) => name === legacyOrderIndexes[1])) {
    await queryInterface.addIndex(
      'orders',
      ['organizationId', 'acceptanceLocationId', 'acceptedOn', 'sequence'],
      { name: legacyOrderIndexes[1], unique: true, transaction },
    )
  }

  await queryInterface.dropTable('number_sequences', { transaction })
  await createLegacySequencesTable(queryInterface, transaction)

  const branchIndexes = await queryInterface.showIndex('branches', { transaction })
  if (branchIndexes.some(({ name }) => name === branchNumberIndex)) {
    await queryInterface.removeIndex('branches', branchNumberIndex, { transaction })
  }
  const branchColumns = await queryInterface.describeTable('branches')
  if (branchColumns.number) {
    await queryInterface.removeColumn('branches', 'number', { transaction })
  }
}
