import { schema } from '../schema.js'

function associate(models) {
  const belongsTo = (source, target, foreignKey, as) =>
    models[source].belongsTo(models[target], { foreignKey, as })
  const hasMany = (source, target, foreignKey, as) =>
    models[source].hasMany(models[target], { foreignKey, as })
  const hasOne = (source, target, foreignKey, as) =>
    models[source].hasOne(models[target], { foreignKey, as })

  hasOne('Organization', 'OrganizationSettings', 'organizationId', 'settings')
  hasMany('Organization', 'Branch', 'organizationId', 'branches')
  belongsTo('Branch', 'Organization', 'organizationId', 'organization')
  hasMany('Branch', 'Location', 'branchId', 'locations')
  belongsTo('Location', 'Branch', 'branchId', 'branch')
  hasMany('Location', 'Workplace', 'locationId', 'workplaces')
  belongsTo('Workplace', 'Location', 'locationId', 'location')

  hasMany('User', 'RefreshSession', 'userId', 'refreshSessions')
  belongsTo('RefreshSession', 'User', 'userId', 'user')
  models.User.belongsToMany(models.Branch, {
    through: models.UserBranch,
    foreignKey: 'userId',
    otherKey: 'branchId',
    as: 'branches',
  })
  models.Branch.belongsToMany(models.User, {
    through: models.UserBranch,
    foreignKey: 'branchId',
    otherKey: 'userId',
    as: 'users',
  })
  models.User.belongsToMany(models.Role, {
    through: models.UserRole,
    foreignKey: 'userId',
    otherKey: 'roleId',
    as: 'roles',
  })
  models.Role.belongsToMany(models.Permission, {
    through: models.RolePermission,
    foreignKey: 'roleId',
    otherKey: 'permissionId',
    as: 'permissions',
  })

  hasMany('Client', 'ClientAddress', 'clientId', 'addresses')
  hasMany('Client', 'ClientConsent', 'clientId', 'consents')
  belongsTo('ClientAddress', 'Client', 'clientId', 'client')
  belongsTo('ClientConsent', 'Client', 'clientId', 'client')

  hasMany('ServiceCategory', 'Service', 'categoryId', 'services')
  belongsTo('Service', 'ServiceCategory', 'categoryId', 'category')
  hasMany('PriceList', 'PriceListItem', 'priceListId', 'items')
  belongsTo('PriceListItem', 'PriceList', 'priceListId', 'priceList')
  belongsTo('PriceListItem', 'Service', 'serviceId', 'service')
  belongsTo('PriceListItem', 'GarmentType', 'garmentTypeId', 'garmentType')

  hasMany('ProductionRoute', 'ProductionRouteStage', 'routeId', 'stages')
  belongsTo('ProductionRouteStage', 'ProductionRoute', 'routeId', 'route')
  belongsTo('ProductionRouteStage', 'ProductionStage', 'stageId', 'stage')

  hasMany('Order', 'OrderItem', 'orderId', 'items')
  belongsTo('Order', 'Client', 'clientId', 'client')
  belongsTo('Order', 'Branch', 'branchId', 'branch')
  belongsTo('OrderItem', 'Order', 'orderId', 'order')
  belongsTo('OrderItem', 'GarmentType', 'garmentTypeId', 'garmentType')
  belongsTo('OrderItem', 'NomenclatureItem', 'nomenclatureItemId', 'nomenclature')
  hasMany('NomenclatureItem', 'OrderItem', 'nomenclatureItemId', 'orderItems')
  belongsTo('OrderItem', 'Material', 'materialId', 'material')
  belongsTo('OrderItem', 'Color', 'colorId', 'color')
  belongsTo('OrderItem', 'ProductionRoute', 'routeId', 'route')
  hasMany('OrderItem', 'OrderItemService', 'orderItemId', 'services')
  belongsTo('OrderItemService', 'OrderItem', 'orderItemId', 'orderItem')
  belongsTo('OrderItemService', 'Service', 'serviceId', 'service')
  hasMany('OrderItem', 'OrderItemDefect', 'orderItemId', 'defects')
  hasMany('OrderItem', 'OrderItemContamination', 'orderItemId', 'contaminations')
  belongsTo('OrderItemDefect', 'Defect', 'defectId', 'defect')
  belongsTo('OrderItemContamination', 'Contamination', 'contaminationId', 'contamination')
  hasMany('OrderItem', 'ItemStageHistory', 'orderItemId', 'stageHistory')
  hasMany('OrderItem', 'ItemMovement', 'orderItemId', 'movements')
  hasMany('OrderItem', 'File', 'orderItemId', 'files')
  belongsTo('File', 'OrderItem', 'orderItemId', 'orderItem')
  hasMany('Order', 'OrderStatusHistory', 'orderId', 'statusHistory')
  hasMany('Order', 'Payment', 'orderId', 'payments')
  hasMany('Order', 'OrderIssue', 'orderId', 'issues')
  hasMany('OrderIssue', 'OrderIssueItem', 'orderIssueId', 'items')

  hasMany('Payment', 'Refund', 'paymentId', 'refunds')
  belongsTo('Refund', 'Payment', 'paymentId', 'payment')
  hasMany('CashShift', 'CashTransaction', 'cashShiftId', 'transactions')
  belongsTo('CashTransaction', 'CashShift', 'cashShiftId', 'cashShift')
  belongsTo('CashTransaction', 'Payment', 'paymentId', 'payment')
}

export function initializeModels(sequelize) {
  if (Object.keys(sequelize.models).length > 0) return sequelize.models

  const models = Object.fromEntries(
    Object.entries(schema).map(([name, definition]) => [
      name,
      sequelize.define(name, definition.attributes, {
        ...definition.options,
        timestamps: true,
      }),
    ]),
  )

  associate(models)
  return models
}
