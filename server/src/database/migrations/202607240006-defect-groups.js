import { DataTypes } from 'sequelize'

export const name = '202607240006-defect-groups'

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
}

const uuid = {
  type: DataTypes.UUID,
  allowNull: false,
}

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables()
  return tables.some((table) =>
    typeof table === 'string'
      ? table === tableName
      : table.tableName === tableName || table.table_name === tableName,
  )
}

export async function up({ queryInterface, transaction }) {
  if (!(await tableExists(queryInterface, 'defect_groups'))) {
    await queryInterface.createTable(
      'defect_groups',
      {
        id: { ...uuid, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        organizationId: {
          ...uuid,
          references: { model: 'organizations', key: 'id' },
        },
        name: { type: DataTypes.STRING(255), allowNull: false },
        archivedAt: { type: DataTypes.DATE, allowNull: true },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    )
    await queryInterface.addIndex('defect_groups', ['organizationId', 'name'], {
      name: 'defect_groups_org_name',
      transaction,
    })
  }

  if (!(await tableExists(queryInterface, 'defect_group_defects'))) {
    await queryInterface.createTable(
      'defect_group_defects',
      {
        id: { ...uuid, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        organizationId: {
          ...uuid,
          references: { model: 'organizations', key: 'id' },
        },
        defectGroupId: {
          ...uuid,
          references: { model: 'defect_groups', key: 'id' },
          onDelete: 'CASCADE',
        },
        defectId: {
          ...uuid,
          references: { model: 'defects', key: 'id' },
          onDelete: 'CASCADE',
        },
        ...timestamps,
      },
      { transaction },
    )
    await queryInterface.addIndex(
      'defect_group_defects',
      ['defectGroupId', 'defectId'],
      {
        name: 'defect_group_defects_unique',
        unique: true,
        transaction,
      },
    )
  }

  const nomenclature = await queryInterface.describeTable('nomenclature_items')
  if (!nomenclature.defectGroupId) {
    await queryInterface.addColumn(
      'nomenclature_items',
      'defectGroupId',
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'defect_groups', key: 'id' },
        onDelete: 'SET NULL',
      },
      { transaction },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  const nomenclature = await queryInterface.describeTable('nomenclature_items')
  if (nomenclature.defectGroupId) {
    await queryInterface.removeColumn('nomenclature_items', 'defectGroupId', {
      transaction,
    })
  }
  if (await tableExists(queryInterface, 'defect_group_defects')) {
    await queryInterface.dropTable('defect_group_defects', { transaction })
  }
  if (await tableExists(queryInterface, 'defect_groups')) {
    await queryInterface.dropTable('defect_groups', { transaction })
  }
}
