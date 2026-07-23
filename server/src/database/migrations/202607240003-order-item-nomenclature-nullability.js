export const name = '202607240003-order-item-nomenclature-nullability'

export async function up({ queryInterface, transaction }) {
  await queryInterface.sequelize.query(
    'ALTER TABLE "order_items" ALTER COLUMN "garmentTypeId" DROP NOT NULL',
    { transaction },
  )
}

export async function down({ queryInterface, transaction }) {
  await queryInterface.sequelize.query(
    'ALTER TABLE "order_items" ALTER COLUMN "garmentTypeId" SET NOT NULL',
    { transaction },
  )
}
