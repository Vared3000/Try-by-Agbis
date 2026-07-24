import { DataTypes } from 'sequelize'

export const name = '202607250002-automatic-due-date'

export async function up({ queryInterface, transaction }) {
  const orderColumns = await queryInterface.describeTable('orders')
  if (!orderColumns.dueDateMode) {
    await queryInterface.addColumn(
      'orders',
      'dueDateMode',
      {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'automatic',
      },
      { transaction },
    )
  }
  const nomenclatureColumns = await queryInterface.describeTable('nomenclature_items')
  if (!nomenclatureColumns.leadTimeHours) {
    await queryInterface.addColumn(
      'nomenclature_items',
      'leadTimeHours',
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 48,
      },
      { transaction },
    )
  }
  await queryInterface.sequelize.query(
    `UPDATE "orders"
        SET "dueDateMode" = CASE
          WHEN "dueAt" IS NULL THEN 'automatic'
          ELSE 'manual'
        END`,
    { transaction },
  )
}

export async function down({ queryInterface, transaction }) {
  const nomenclatureColumns = await queryInterface.describeTable('nomenclature_items')
  if (nomenclatureColumns.leadTimeHours) {
    await queryInterface.removeColumn('nomenclature_items', 'leadTimeHours', {
      transaction,
    })
  }
  const orderColumns = await queryInterface.describeTable('orders')
  if (orderColumns.dueDateMode) {
    await queryInterface.removeColumn('orders', 'dueDateMode', { transaction })
  }
}
