import { DataTypes } from 'sequelize'

export const name = '202607240002-nomenclature-items'

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
}

export async function up({ queryInterface, transaction }) {
  const tables = await queryInterface.showAllTables({ transaction })
  if (!tables.includes('nomenclature_items')) {
    await queryInterface.createTable(
      'nomenclature_items',
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
        name: { type: DataTypes.STRING(255), allowNull: false },
        unit: { type: DataTypes.STRING(32), allowNull: false },
        calculationType: { type: DataTypes.STRING(32), allowNull: false },
        unitPrice: { type: DataTypes.BIGINT, allowNull: false },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: 'RUB',
        },
        archivedAt: { type: DataTypes.DATE, allowNull: true },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    )
  }

  const indexes = await queryInterface.showIndex('nomenclature_items', {
    transaction,
  })
  if (!indexes.some((index) => index.name === 'nomenclature_items_org_name')) {
    await queryInterface.addIndex('nomenclature_items', ['organizationId', 'name'], {
      name: 'nomenclature_items_org_name',
      transaction,
    })
  }

  const columns = await queryInterface.describeTable('order_items', {
    transaction,
  })
  if (!columns.nomenclatureItemId) {
    await queryInterface.addColumn(
      'order_items',
      'nomenclatureItemId',
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'nomenclature_items', key: 'id' },
      },
      { transaction },
    )
  }
  for (const column of ['quantity', 'length', 'width', 'area']) {
    if (!columns[column]) {
      await queryInterface.addColumn(
        'order_items',
        column,
        { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        { transaction },
      )
    }
  }
  if (!columns.unitPrice) {
    await queryInterface.addColumn(
      'order_items',
      'unitPrice',
      { type: DataTypes.BIGINT, allowNull: true },
      { transaction },
    )
  }
  await queryInterface.sequelize.query(
    'ALTER TABLE "order_items" ALTER COLUMN "garmentTypeId" DROP NOT NULL',
    { transaction },
  )
}

export async function down({ queryInterface, transaction }) {
  for (const column of [
    'unitPrice',
    'area',
    'width',
    'length',
    'quantity',
    'nomenclatureItemId',
  ]) {
    await queryInterface.removeColumn('order_items', column, { transaction })
  }
  await queryInterface.changeColumn(
    'order_items',
    'garmentTypeId',
    {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'garment_types', key: 'id' },
    },
    { transaction },
  )
  await queryInterface.dropTable('nomenclature_items', { transaction })
}
