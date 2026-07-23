import { schema } from '../schema.js'

const monetaryColumns = {
  price_list_items: ['price'],
  orders: ['subtotalAmount', 'discountAmount', 'totalAmount', 'paidAmount'],
  order_items: ['totalAmount'],
  order_item_services: ['unitPrice', 'totalPrice'],
  cash_shifts: ['openingAmount', 'closingAmount'],
  payments: ['amount'],
  refunds: ['amount'],
  cash_transactions: ['amount'],
}

export const name = '202607230001-initial-schema'

export async function up({ queryInterface, transaction }) {
  for (const definition of Object.values(schema)) {
    await queryInterface.createTable(
      definition.options.tableName,
      definition.attributes,
      {
        transaction,
      },
    )
  }

  for (const definition of Object.values(schema)) {
    const tableName = definition.options.tableName
    for (const index of definition.options.indexes ?? []) {
      if (
        tableName === 'price_list_items' &&
        index.name === 'price_list_items_scope_unique'
      ) {
        continue
      }
      await queryInterface.addIndex(tableName, index.fields, {
        name: index.name,
        unique: index.unique ?? false,
        transaction,
      })
    }
  }

  await queryInterface.addIndex(
    'price_list_items',
    ['priceListId', 'serviceId', 'garmentTypeId'],
    {
      name: 'price_list_items_with_garment_unique',
      unique: true,
      where: { garmentTypeId: { [queryInterface.sequelize.Sequelize.Op.ne]: null } },
      transaction,
    },
  )
  await queryInterface.addIndex('price_list_items', ['priceListId', 'serviceId'], {
    name: 'price_list_items_without_garment_unique',
    unique: true,
    where: { garmentTypeId: null },
    transaction,
  })

  for (const [tableName, columns] of Object.entries(monetaryColumns)) {
    for (const column of columns) {
      await queryInterface.addConstraint(tableName, {
        type: 'check',
        name: `${tableName}_${column}_nonnegative`,
        fields: [column],
        where: {
          [column]: { [queryInterface.sequelize.Sequelize.Op.gte]: 0 },
        },
        transaction,
      })
    }
  }

  await queryInterface.addConstraint('order_item_services', {
    type: 'check',
    name: 'order_item_services_quantity_positive',
    fields: ['quantity'],
    where: {
      quantity: { [queryInterface.sequelize.Sequelize.Op.gt]: 0 },
    },
    transaction,
  })
  await queryInterface.addConstraint('price_lists', {
    type: 'check',
    name: 'price_lists_date_range_valid',
    fields: ['validFrom', 'validTo'],
    where: queryInterface.sequelize.literal(
      '"validTo" IS NULL OR "validTo" >= "validFrom"',
    ),
    transaction,
  })
}

export async function down({ queryInterface, transaction }) {
  for (const definition of Object.values(schema).reverse()) {
    await queryInterface.dropTable(definition.options.tableName, { transaction })
  }
}
