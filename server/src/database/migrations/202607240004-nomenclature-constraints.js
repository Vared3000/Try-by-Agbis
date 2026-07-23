export const name = '202607240004-nomenclature-constraints'

const constraints = [
  ['nomenclature_items', 'nomenclature_items_unit_price_nonnegative', '"unitPrice" >= 0'],
  ['order_items', 'order_items_unit_price_nonnegative', '"unitPrice" >= 0'],
  ['order_items', 'order_items_quantity_positive', '"quantity" > 0'],
  ['order_items', 'order_items_length_positive', '"length" > 0'],
  ['order_items', 'order_items_width_positive', '"width" > 0'],
  ['order_items', 'order_items_area_positive', '"area" > 0'],
]

export async function up({ queryInterface, transaction }) {
  for (const [table, name, expression] of constraints) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression})`,
      { transaction },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  for (const [table, name] of [...constraints].reverse()) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`,
      { transaction },
    )
  }
}
