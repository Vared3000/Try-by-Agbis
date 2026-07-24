export const name = '202607240005-order-number-scope'

const legacyIndex = 'orders_organization_id_acceptance_location_id_sequence'
const scopedIndex = 'orders_organization_id_acceptance_location_id_accepted_on_sequence'

export async function up({ queryInterface, transaction }) {
  const indexes = await queryInterface.showIndex('orders', { transaction })
  if (indexes.some(({ name }) => name === legacyIndex)) {
    await queryInterface.removeIndex('orders', legacyIndex, { transaction })
  }
  if (!indexes.some(({ name }) => name === scopedIndex)) {
    await queryInterface.addIndex(
      'orders',
      ['organizationId', 'acceptanceLocationId', 'acceptedOn', 'sequence'],
      {
        name: scopedIndex,
        unique: true,
        transaction,
      },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  const indexes = await queryInterface.showIndex('orders', { transaction })
  if (indexes.some(({ name }) => name === scopedIndex)) {
    await queryInterface.removeIndex('orders', scopedIndex, { transaction })
  }
  if (!indexes.some(({ name }) => name === legacyIndex)) {
    await queryInterface.addIndex(
      'orders',
      ['organizationId', 'acceptanceLocationId', 'sequence'],
      {
        name: legacyIndex,
        unique: true,
        transaction,
      },
    )
  }
}
