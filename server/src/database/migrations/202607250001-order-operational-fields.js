import { DataTypes } from 'sequelize'

export const name = '202607250001-order-operational-fields'

export async function up({ queryInterface, transaction }) {
  const columns = await queryInterface.describeTable('orders')
  if (!columns.issueLocationId) {
    await queryInterface.addColumn(
      'orders',
      'issueLocationId',
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'locations', key: 'id' },
      },
      { transaction },
    )
  }
  if (!columns.urgency) {
    await queryInterface.addColumn(
      'orders',
      'urgency',
      {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'normal',
      },
      { transaction },
    )
  }
  if (!columns.notificationPhone) {
    await queryInterface.addColumn(
      'orders',
      'notificationPhone',
      { type: DataTypes.STRING(32), allowNull: true },
      { transaction },
    )
  }
  if (!columns.isRework) {
    await queryInterface.addColumn(
      'orders',
      'isRework',
      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      { transaction },
    )
  }
  await queryInterface.sequelize.query(
    `UPDATE "orders"
        SET "issueLocationId" = "acceptanceLocationId"
      WHERE "issueLocationId" IS NULL`,
    { transaction },
  )
  await queryInterface.addIndex('orders', ['organizationId', 'issueLocationId'], {
    name: 'orders_organization_issue_location',
    transaction,
  })
}

export async function down({ queryInterface, transaction }) {
  const indexes = await queryInterface.showIndex('orders', { transaction })
  if (
    indexes.some(
      ({ name: indexName }) => indexName === 'orders_organization_issue_location',
    )
  ) {
    await queryInterface.removeIndex('orders', 'orders_organization_issue_location', {
      transaction,
    })
  }
  for (const column of ['isRework', 'notificationPhone', 'urgency', 'issueLocationId']) {
    const columns = await queryInterface.describeTable('orders')
    if (columns[column]) {
      await queryInterface.removeColumn('orders', column, { transaction })
    }
  }
}
