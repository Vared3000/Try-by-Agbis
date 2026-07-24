import { DataTypes, Op } from 'sequelize'

export const name = '202607240007-price-list-nomenclature'

const targetConstraint = 'price_list_items_target_valid'
const nomenclatureIndex = 'price_list_items_nomenclature_unique'

const hasConstraint = async (queryInterface, constraintName, transaction) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM pg_constraint
      WHERE conname = :constraintName`,
    { replacements: { constraintName }, transaction },
  )
  return rows.length > 0
}

export async function up({ queryInterface, transaction }) {
  const columns = await queryInterface.describeTable('price_list_items')
  await queryInterface.sequelize.query(
    `ALTER TABLE "price_list_items" ALTER COLUMN "serviceId" DROP NOT NULL`,
    { transaction },
  )
  if (!columns.nomenclatureItemId) {
    await queryInterface.addColumn(
      'price_list_items',
      'nomenclatureItemId',
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'nomenclature_items', key: 'id' },
        onDelete: 'CASCADE',
      },
      { transaction },
    )
  }

  const indexes = await queryInterface.showIndex('price_list_items', { transaction })
  if (!indexes.some(({ name }) => name === nomenclatureIndex)) {
    await queryInterface.addIndex(
      'price_list_items',
      ['priceListId', 'nomenclatureItemId'],
      {
        name: nomenclatureIndex,
        unique: true,
        where: { nomenclatureItemId: { [Op.ne]: null } },
        transaction,
      },
    )
  }
  if (!(await hasConstraint(queryInterface, targetConstraint, transaction))) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "price_list_items"
       ADD CONSTRAINT "${targetConstraint}"
       CHECK (
         ("nomenclatureItemId" IS NOT NULL AND "serviceId" IS NULL AND "garmentTypeId" IS NULL)
         OR
         ("nomenclatureItemId" IS NULL AND "serviceId" IS NOT NULL)
       )`,
      { transaction },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  if (await hasConstraint(queryInterface, targetConstraint, transaction)) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "price_list_items" DROP CONSTRAINT "${targetConstraint}"`,
      { transaction },
    )
  }
  const indexes = await queryInterface.showIndex('price_list_items', { transaction })
  if (indexes.some(({ name }) => name === nomenclatureIndex)) {
    await queryInterface.removeIndex('price_list_items', nomenclatureIndex, {
      transaction,
    })
  }
  const columns = await queryInterface.describeTable('price_list_items')
  if (columns.nomenclatureItemId) {
    await queryInterface.sequelize.query(
      `DELETE FROM "price_list_items" WHERE "nomenclatureItemId" IS NOT NULL`,
      { transaction },
    )
    await queryInterface.removeColumn('price_list_items', 'nomenclatureItemId', {
      transaction,
    })
  }
  await queryInterface.changeColumn(
    'price_list_items',
    'serviceId',
    {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'services', key: 'id' },
    },
    { transaction },
  )
}
