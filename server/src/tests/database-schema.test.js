import { Sequelize } from 'sequelize'
import { describe, expect, it } from 'vitest'

import { initializeModels } from '../database/models/index.js'
import { schema } from '../database/schema.js'

describe('database schema', () => {
  it('defines every MVP entity with UUID identifiers and timestamps', () => {
    expect(Object.keys(schema)).toHaveLength(52)

    for (const definition of Object.values(schema)) {
      expect(definition.options.tableName).toBeTruthy()
      expect(definition.attributes.id.primaryKey).toBe(true)
      expect(definition.attributes.id.type.key).toBe('UUID')
      expect(definition.attributes.createdAt.allowNull).toBe(false)
      expect(definition.attributes.updatedAt.allowNull).toBe(false)
    }
  })

  it('requires organizationId on every tenant entity', () => {
    const globalEntities = new Set(['Organization', 'OrganizationSettings', 'Permission'])

    for (const [name, definition] of Object.entries(schema)) {
      if (globalEntities.has(name)) continue
      expect(definition.attributes.organizationId.allowNull, name).toBe(false)
    }
  })

  it('contains the critical uniqueness constraints', () => {
    const indexFields = (name) =>
      (schema[name].options.indexes ?? []).map((index) => index.fields.join(','))

    expect(indexFields('Branch')).toContain('organizationId,code')
    expect(indexFields('Branch')).toContain('organizationId,number')
    expect(indexFields('Order')).toContain('organizationId,branchId,sequence')
    expect(indexFields('Order')).toContain('organizationId,displayNumber')
    expect(schema.OrderItem.attributes.scanCode.unique).toBe(true)
    expect(schema.OrderIssueItem.attributes.orderItemId.unique).toBe(true)
    expect(indexFields('Payment')).toContain('organizationId,idempotencyKey')
    expect(indexFields('Refund')).toContain('organizationId,idempotencyKey')
    expect(indexFields('OrderIssue')).toContain('organizationId,idempotencyKey')
    expect(indexFields('TransferDocument')).toContain('organizationId,displayNumber')
    expect(indexFields('TransferDocumentItem')).toContain('transferDocumentId,orderItemId')
  })

  it('initializes all models and principal associations without connecting', async () => {
    const sequelize = new Sequelize('postgres://test:test@localhost/test', {
      logging: false,
    })

    try {
      const models = initializeModels(sequelize)
      expect(Object.keys(models)).toHaveLength(52)
      expect(models.Organization.associations.branches).toBeTruthy()
      expect(models.User.associations.roles).toBeTruthy()
      expect(models.Order.associations.items).toBeTruthy()
      expect(models.Order.associations.acceptanceLocation).toBeTruthy()
      expect(models.Order.associations.issueLocation).toBeTruthy()
      expect(models.Order.associations.createdBy).toBeTruthy()
      expect(models.OrderItem.associations.stageHistory).toBeTruthy()
      expect(models.OrderItem.associations.nomenclature).toBeTruthy()
      expect(models.NomenclatureItem.associations.defectGroup).toBeTruthy()
      expect(models.DefectGroup.associations.defects).toBeTruthy()
      expect(models.Payment.associations.refunds).toBeTruthy()
      expect(models.TransferDocument.associations.items).toBeTruthy()
      expect(models.TransferDocumentItem.associations.orderItem).toBeTruthy()
    } finally {
      await sequelize.close()
    }
  })
})
