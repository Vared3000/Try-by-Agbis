import { DataTypes } from 'sequelize'

export const name = '202607250003-transfer-documents'

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
  if (!(await tableExists(queryInterface, 'transfer_documents'))) {
    await queryInterface.createTable(
      'transfer_documents',
      {
        id: { ...uuid, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        organizationId: {
          ...uuid,
          references: { model: 'organizations', key: 'id' },
        },
        displayNumber: { type: DataTypes.STRING(64), allowNull: false },
        fromLocationId: {
          ...uuid,
          references: { model: 'locations', key: 'id' },
        },
        toLocationId: {
          ...uuid,
          references: { model: 'locations', key: 'id' },
        },
        status: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'draft',
        },
        notes: { type: DataTypes.STRING(1000), allowNull: true },
        createdByUserId: {
          ...uuid,
          references: { model: 'users', key: 'id' },
        },
        sentAt: { type: DataTypes.DATE, allowNull: true },
        receivedAt: { type: DataTypes.DATE, allowNull: true },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    )
    await queryInterface.addIndex(
      'transfer_documents',
      ['organizationId', 'displayNumber'],
      {
        name: 'transfer_documents_org_display_number',
        unique: true,
        transaction,
      },
    )
    await queryInterface.addIndex(
      'transfer_documents',
      ['organizationId', 'status', 'createdAt'],
      {
        name: 'transfer_documents_org_status_created',
        transaction,
      },
    )
  }

  if (!(await tableExists(queryInterface, 'transfer_document_items'))) {
    await queryInterface.createTable(
      'transfer_document_items',
      {
        id: { ...uuid, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        organizationId: {
          ...uuid,
          references: { model: 'organizations', key: 'id' },
        },
        transferDocumentId: {
          ...uuid,
          references: { model: 'transfer_documents', key: 'id' },
          onDelete: 'CASCADE',
        },
        orderItemId: {
          ...uuid,
          references: { model: 'order_items', key: 'id' },
        },
        status: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'planned',
        },
        ...timestamps,
      },
      { transaction },
    )
    await queryInterface.addIndex(
      'transfer_document_items',
      ['transferDocumentId', 'orderItemId'],
      {
        name: 'transfer_document_items_unique',
        unique: true,
        transaction,
      },
    )
  }
}

export async function down({ queryInterface, transaction }) {
  if (await tableExists(queryInterface, 'transfer_document_items')) {
    await queryInterface.dropTable('transfer_document_items', { transaction })
  }
  if (await tableExists(queryInterface, 'transfer_documents')) {
    await queryInterface.dropTable('transfer_documents', { transaction })
  }
}
