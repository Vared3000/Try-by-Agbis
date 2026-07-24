export const name = '202607240008-price-list-service-nullability'

export async function up({ queryInterface, transaction }) {
  await queryInterface.sequelize.query(
    `ALTER TABLE "price_list_items" ALTER COLUMN "serviceId" DROP NOT NULL`,
    { transaction },
  )
}

export async function down() {
  // Migration 007 restores NOT NULL after removing nomenclature-only rows.
}
