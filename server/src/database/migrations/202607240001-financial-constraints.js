export const name = '202607240001-financial-constraints'

export async function up({ queryInterface, transaction }) {
  await queryInterface.addIndex('cash_shifts', ['organizationId', 'workplaceId'], {
    name: 'cash_shifts_one_open_per_workplace',
    unique: true,
    where: { status: 'open' },
    transaction,
  })
}

export async function down({ queryInterface, transaction }) {
  await queryInterface.removeIndex('cash_shifts', 'cash_shifts_one_open_per_workplace', {
    transaction,
  })
}
