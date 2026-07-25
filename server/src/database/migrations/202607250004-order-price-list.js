import { DataTypes } from 'sequelize'

export const name = '202607250004-order-price-list'

export async function up({ queryInterface, transaction }) {
  const columns = await queryInterface.describeTable('orders')
  if (!columns.priceListId) {
    await queryInterface.addColumn(
      'orders',
      'priceListId',
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'price_lists', key: 'id' },
      },
      { transaction },
    )
  }
  const indexes = await queryInterface.showIndex('orders', { transaction })
  if (!indexes.some(({ name: indexName }) => indexName === 'orders_organization_price_list')) {
    await queryInterface.addIndex('orders', ['organizationId', 'priceListId'], {
      name: 'orders_organization_price_list',
      transaction,
    })
  }
}

export async function down({ queryInterface, transaction }) {
  const indexes = await queryInterface.showIndex('orders', { transaction })
  if (indexes.some(({ name: indexName }) => indexName === 'orders_organization_price_list')) {
    await queryInterface.removeIndex('orders', 'orders_organization_price_list', {
      transaction,
    })
  }
  const columns = await queryInterface.describeTable('orders')
  if (columns.priceListId) {
    await queryInterface.removeColumn('orders', 'priceListId', { transaction })
  }
}
