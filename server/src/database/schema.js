import { DataTypes } from 'sequelize'

const uuid = (references) => ({
  type: DataTypes.UUID,
  allowNull: false,
  ...(references
    ? { references: { model: references.tableName, key: references.key } }
    : {}),
})

const nullableUuid = (references) => ({
  type: DataTypes.UUID,
  allowNull: true,
  ...(references
    ? { references: { model: references.tableName, key: references.key } }
    : {}),
})

const string = (length = 255, allowNull = false) => ({
  type: DataTypes.STRING(length),
  allowNull,
})

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
}

const entity = (attributes, options = {}) => ({
  attributes: {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    ...attributes,
    ...timestamps,
  },
  options,
})

const tenantEntity = (attributes, options = {}) =>
  entity(
    {
      organizationId: uuid({ tableName: 'organizations', key: 'id' }),
      ...attributes,
    },
    options,
  )

const archived = {
  archivedAt: { type: DataTypes.DATE, allowNull: true },
}

const versioned = {
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}

const money = (allowNull = false) => ({
  type: DataTypes.BIGINT,
  allowNull,
  validate: { min: 0 },
})

export const schema = {
  Organization: entity(
    {
      name: string(),
      legalName: string(255, true),
      taxId: string(32, true),
      status: string(32),
      ...versioned,
    },
    { tableName: 'organizations' },
  ),
  OrganizationSettings: entity(
    {
      organizationId: {
        ...uuid({ tableName: 'organizations', key: 'id' }),
        unique: true,
      },
      locale: { ...string(16), defaultValue: 'ru-RU' },
      currency: { ...string(3), defaultValue: 'RUB' },
      timezone: { ...string(64), defaultValue: 'Europe/Moscow' },
      settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: 'organization_settings' },
  ),
  Branch: tenantEntity(
    {
      number: { type: DataTypes.INTEGER, allowNull: false },
      code: string(32),
      name: string(),
      address: { type: DataTypes.TEXT, allowNull: true },
      ...archived,
      ...versioned,
    },
    {
      tableName: 'branches',
      indexes: [
        { unique: true, fields: ['organizationId', 'code'] },
        {
          unique: true,
          name: 'branches_organization_number_unique',
          fields: ['organizationId', 'number'],
        },
      ],
    },
  ),
  Location: tenantEntity(
    {
      branchId: uuid({ tableName: 'branches', key: 'id' }),
      code: string(32),
      name: string(),
      type: string(32),
      ...archived,
    },
    {
      tableName: 'locations',
      indexes: [{ unique: true, fields: ['branchId', 'code'] }],
    },
  ),
  Workplace: tenantEntity(
    {
      locationId: uuid({ tableName: 'locations', key: 'id' }),
      code: string(32),
      name: string(),
      type: string(32),
      ...archived,
    },
    {
      tableName: 'workplaces',
      indexes: [{ unique: true, fields: ['locationId', 'code'] }],
    },
  ),
  User: tenantEntity(
    {
      email: string(320),
      displayName: string(),
      passwordHash: string(255, true),
      status: string(32),
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      ...versioned,
    },
    {
      tableName: 'users',
      indexes: [{ unique: true, fields: ['organizationId', 'email'] }],
    },
  ),
  Role: tenantEntity(
    {
      code: string(64),
      name: string(),
      system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...archived,
    },
    {
      tableName: 'roles',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  Permission: entity(
    { code: { ...string(128), unique: true }, description: string(500, true) },
    { tableName: 'permissions' },
  ),
  UserBranch: tenantEntity(
    {
      userId: uuid({ tableName: 'users', key: 'id' }),
      branchId: uuid({ tableName: 'branches', key: 'id' }),
    },
    {
      tableName: 'user_branches',
      indexes: [{ unique: true, fields: ['userId', 'branchId'] }],
    },
  ),
  UserRole: tenantEntity(
    {
      userId: uuid({ tableName: 'users', key: 'id' }),
      roleId: uuid({ tableName: 'roles', key: 'id' }),
    },
    {
      tableName: 'user_roles',
      indexes: [{ unique: true, fields: ['userId', 'roleId'] }],
    },
  ),
  RolePermission: tenantEntity(
    {
      roleId: uuid({ tableName: 'roles', key: 'id' }),
      permissionId: uuid({ tableName: 'permissions', key: 'id' }),
    },
    {
      tableName: 'role_permissions',
      indexes: [{ unique: true, fields: ['roleId', 'permissionId'] }],
    },
  ),
  RefreshSession: tenantEntity(
    {
      userId: uuid({ tableName: 'users', key: 'id' }),
      tokenHash: { ...string(255), unique: true },
      familyId: { type: DataTypes.UUID, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      replacedById: nullableUuid({ tableName: 'refresh_sessions', key: 'id' }),
      userAgent: string(500, true),
      ipAddress: { type: DataTypes.INET, allowNull: true },
    },
    { tableName: 'refresh_sessions' },
  ),
  Client: tenantEntity(
    {
      fullName: string(),
      phone: string(32, true),
      email: string(320, true),
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...archived,
      ...versioned,
    },
    {
      tableName: 'clients',
      indexes: [
        { fields: ['organizationId', 'phone'] },
        { fields: ['organizationId', 'fullName'] },
      ],
    },
  ),
  ClientAddress: tenantEntity(
    {
      clientId: uuid({ tableName: 'clients', key: 'id' }),
      label: string(64, true),
      address: { type: DataTypes.TEXT, allowNull: false },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'client_addresses' },
  ),
  ClientConsent: tenantEntity(
    {
      clientId: uuid({ tableName: 'clients', key: 'id' }),
      type: string(64),
      textVersion: string(64),
      granted: { type: DataTypes.BOOLEAN, allowNull: false },
      channel: string(32),
      acceptedByUserId: nullableUuid({ tableName: 'users', key: 'id' }),
      acceptedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'client_consents' },
  ),
  ServiceCategory: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'service_categories',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  Service: tenantEntity(
    {
      categoryId: nullableUuid({ tableName: 'service_categories', key: 'id' }),
      code: string(64),
      name: string(),
      unit: string(32),
      ...archived,
      ...versioned,
    },
    {
      tableName: 'services',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  GarmentType: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'garment_types',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  Defect: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'defects',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  DefectGroup: tenantEntity(
    {
      name: string(),
      ...archived,
      ...versioned,
    },
    {
      tableName: 'defect_groups',
      indexes: [
        {
          name: 'defect_groups_org_name',
          fields: ['organizationId', 'name'],
        },
      ],
    },
  ),
  DefectGroupDefect: tenantEntity(
    {
      defectGroupId: uuid({ tableName: 'defect_groups', key: 'id' }),
      defectId: uuid({ tableName: 'defects', key: 'id' }),
    },
    {
      tableName: 'defect_group_defects',
      indexes: [
        {
          unique: true,
          name: 'defect_group_defects_unique',
          fields: ['defectGroupId', 'defectId'],
        },
      ],
    },
  ),
  NomenclatureItem: tenantEntity(
    {
      name: string(),
      unit: string(32),
      calculationType: string(32),
      unitPrice: money(),
      leadTimeHours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 48 },
      currency: { ...string(3), defaultValue: 'RUB' },
      defectGroupId: nullableUuid({ tableName: 'defect_groups', key: 'id' }),
      ...archived,
      ...versioned,
    },
    {
      tableName: 'nomenclature_items',
      indexes: [
        {
          name: 'nomenclature_items_org_name',
          fields: ['organizationId', 'name'],
        },
      ],
    },
  ),
  Material: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'materials',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  Color: tenantEntity(
    { code: string(64), name: string(), hex: string(7, true), ...archived },
    {
      tableName: 'colors',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  Contamination: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'contaminations',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  PriceList: tenantEntity(
    {
      name: string(),
      validFrom: { type: DataTypes.DATEONLY, allowNull: false },
      validTo: { type: DataTypes.DATEONLY, allowNull: true },
      status: string(32),
      ...versioned,
    },
    { tableName: 'price_lists' },
  ),
  PriceListItem: tenantEntity(
    {
      priceListId: uuid({ tableName: 'price_lists', key: 'id' }),
      serviceId: nullableUuid({ tableName: 'services', key: 'id' }),
      garmentTypeId: nullableUuid({ tableName: 'garment_types', key: 'id' }),
      nomenclatureItemId: nullableUuid({
        tableName: 'nomenclature_items',
        key: 'id',
      }),
      price: money(),
    },
    {
      tableName: 'price_list_items',
      indexes: [
        {
          unique: true,
          fields: ['priceListId', 'serviceId', 'garmentTypeId'],
          name: 'price_list_items_scope_unique',
        },
        {
          unique: true,
          fields: ['priceListId', 'nomenclatureItemId'],
          name: 'price_list_items_nomenclature_unique',
        },
      ],
    },
  ),
  ProductionStage: tenantEntity(
    { code: string(64), name: string(), ...archived },
    {
      tableName: 'production_stages',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  ProductionRoute: tenantEntity(
    { code: string(64), name: string(), ...archived, ...versioned },
    {
      tableName: 'production_routes',
      indexes: [{ unique: true, fields: ['organizationId', 'code'] }],
    },
  ),
  ProductionRouteStage: tenantEntity(
    {
      routeId: uuid({ tableName: 'production_routes', key: 'id' }),
      stageId: uuid({ tableName: 'production_stages', key: 'id' }),
      position: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
      required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'production_route_stages',
      indexes: [
        { unique: true, fields: ['routeId', 'position'] },
        { unique: true, fields: ['routeId', 'stageId'] },
      ],
    },
  ),
  NumberSequence: tenantEntity(
    {
      branchId: uuid({ tableName: 'branches', key: 'id' }),
      nextValue: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 1 },
    },
    {
      tableName: 'number_sequences',
      indexes: [
        {
          unique: true,
          name: 'number_sequences_organization_branch_unique',
          fields: ['organizationId', 'branchId'],
        },
      ],
    },
  ),
  Order: tenantEntity(
    {
      branchId: uuid({ tableName: 'branches', key: 'id' }),
      acceptanceLocationId: uuid({ tableName: 'locations', key: 'id' }),
      issueLocationId: nullableUuid({ tableName: 'locations', key: 'id' }),
      clientId: uuid({ tableName: 'clients', key: 'id' }),
      sequence: { type: DataTypes.BIGINT, allowNull: false },
      displayNumber: string(64),
      acceptedOn: { type: DataTypes.DATEONLY, allowNull: false },
      dueAt: { type: DataTypes.DATE, allowNull: true },
      dueDateMode: { ...string(32), defaultValue: 'automatic' },
      urgency: { ...string(32), defaultValue: 'normal' },
      notificationPhone: string(32, true),
      isRework: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: string(32),
      subtotalAmount: money(),
      discountAmount: money(),
      totalAmount: money(),
      paidAmount: money(),
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdByUserId: uuid({ tableName: 'users', key: 'id' }),
      ...versioned,
    },
    {
      tableName: 'orders',
      indexes: [
        {
          unique: true,
          name: 'orders_organization_id_branch_id_sequence',
          fields: ['organizationId', 'branchId', 'sequence'],
        },
        { unique: true, fields: ['organizationId', 'displayNumber'] },
        { fields: ['organizationId', 'clientId', 'createdAt'] },
        { fields: ['organizationId', 'status'] },
        {
          name: 'orders_organization_issue_location',
          fields: ['organizationId', 'issueLocationId'],
        },
      ],
    },
  ),
  OrderItem: tenantEntity(
    {
      orderId: uuid({ tableName: 'orders', key: 'id' }),
      scanCode: { ...string(128), unique: true },
      garmentTypeId: nullableUuid({ tableName: 'garment_types', key: 'id' }),
      nomenclatureItemId: nullableUuid({
        tableName: 'nomenclature_items',
        key: 'id',
      }),
      materialId: nullableUuid({ tableName: 'materials', key: 'id' }),
      colorId: nullableUuid({ tableName: 'colors', key: 'id' }),
      routeId: nullableUuid({ tableName: 'production_routes', key: 'id' }),
      status: string(32),
      description: string(500, true),
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      length: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      width: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      area: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      unitPrice: money(true),
      totalAmount: money(),
      ...versioned,
    },
    {
      tableName: 'order_items',
      indexes: [
        { fields: ['organizationId', 'orderId'] },
        { fields: ['organizationId', 'status'] },
      ],
    },
  ),
  OrderItemService: tenantEntity(
    {
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      serviceId: uuid({ tableName: 'services', key: 'id' }),
      serviceName: string(),
      unitPrice: money(),
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      totalPrice: money(),
    },
    { tableName: 'order_item_services' },
  ),
  OrderItemDefect: tenantEntity(
    {
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      defectId: uuid({ tableName: 'defects', key: 'id' }),
      notes: string(500, true),
    },
    {
      tableName: 'order_item_defects',
      indexes: [{ unique: true, fields: ['orderItemId', 'defectId'] }],
    },
  ),
  OrderItemContamination: tenantEntity(
    {
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      contaminationId: uuid({ tableName: 'contaminations', key: 'id' }),
      notes: string(500, true),
    },
    {
      tableName: 'order_item_contaminations',
      indexes: [{ unique: true, fields: ['orderItemId', 'contaminationId'] }],
    },
  ),
  OrderStatusHistory: tenantEntity(
    {
      orderId: uuid({ tableName: 'orders', key: 'id' }),
      fromStatus: string(32, true),
      toStatus: string(32),
      changedByUserId: nullableUuid({ tableName: 'users', key: 'id' }),
      reason: string(500, true),
      changedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'order_status_history',
      indexes: [{ fields: ['organizationId', 'orderId', 'changedAt'] }],
    },
  ),
  ItemStageHistory: tenantEntity(
    {
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      stageId: uuid({ tableName: 'production_stages', key: 'id' }),
      status: string(32),
      workplaceId: nullableUuid({ tableName: 'workplaces', key: 'id' }),
      assignedUserId: nullableUuid({ tableName: 'users', key: 'id' }),
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      notes: string(500, true),
    },
    {
      tableName: 'item_stage_history',
      indexes: [{ fields: ['organizationId', 'orderItemId', 'createdAt'] }],
    },
  ),
  ItemMovement: tenantEntity(
    {
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      fromLocationId: nullableUuid({ tableName: 'locations', key: 'id' }),
      toLocationId: uuid({ tableName: 'locations', key: 'id' }),
      movedByUserId: uuid({ tableName: 'users', key: 'id' }),
      movedAt: { type: DataTypes.DATE, allowNull: false },
      reason: string(500, true),
    },
    { tableName: 'item_movements' },
  ),
  TransferDocument: tenantEntity(
    {
      displayNumber: string(64),
      fromLocationId: uuid({ tableName: 'locations', key: 'id' }),
      toLocationId: uuid({ tableName: 'locations', key: 'id' }),
      status: { ...string(32), defaultValue: 'draft' },
      notes: string(1000, true),
      createdByUserId: uuid({ tableName: 'users', key: 'id' }),
      sentAt: { type: DataTypes.DATE, allowNull: true },
      receivedAt: { type: DataTypes.DATE, allowNull: true },
      ...versioned,
    },
    {
      tableName: 'transfer_documents',
      indexes: [
        { unique: true, fields: ['organizationId', 'displayNumber'] },
        { fields: ['organizationId', 'status', 'createdAt'] },
      ],
    },
  ),
  TransferDocumentItem: tenantEntity(
    {
      transferDocumentId: uuid({ tableName: 'transfer_documents', key: 'id' }),
      orderItemId: uuid({ tableName: 'order_items', key: 'id' }),
      status: { ...string(32), defaultValue: 'planned' },
    },
    {
      tableName: 'transfer_document_items',
      indexes: [{ unique: true, fields: ['transferDocumentId', 'orderItemId'] }],
    },
  ),
  OrderIssue: tenantEntity(
    {
      orderId: uuid({ tableName: 'orders', key: 'id' }),
      idempotencyKey: string(128),
      issuedByUserId: uuid({ tableName: 'users', key: 'id' }),
      issuedAt: { type: DataTypes.DATE, allowNull: false },
      notes: string(500, true),
    },
    {
      tableName: 'order_issues',
      indexes: [{ unique: true, fields: ['organizationId', 'idempotencyKey'] }],
    },
  ),
  OrderIssueItem: tenantEntity(
    {
      orderIssueId: uuid({ tableName: 'order_issues', key: 'id' }),
      orderItemId: {
        ...uuid({ tableName: 'order_items', key: 'id' }),
        unique: true,
      },
    },
    { tableName: 'order_issue_items' },
  ),
  CashShift: tenantEntity(
    {
      branchId: uuid({ tableName: 'branches', key: 'id' }),
      workplaceId: uuid({ tableName: 'workplaces', key: 'id' }),
      openedByUserId: uuid({ tableName: 'users', key: 'id' }),
      closedByUserId: nullableUuid({ tableName: 'users', key: 'id' }),
      openedAt: { type: DataTypes.DATE, allowNull: false },
      closedAt: { type: DataTypes.DATE, allowNull: true },
      openingAmount: money(),
      closingAmount: money(true),
      status: string(32),
      ...versioned,
    },
    { tableName: 'cash_shifts' },
  ),
  Payment: tenantEntity(
    {
      orderId: uuid({ tableName: 'orders', key: 'id' }),
      cashShiftId: nullableUuid({ tableName: 'cash_shifts', key: 'id' }),
      idempotencyKey: string(128),
      amount: money(),
      method: string(32),
      status: string(32),
      receivedByUserId: uuid({ tableName: 'users', key: 'id' }),
      paidAt: { type: DataTypes.DATE, allowNull: false },
      externalReference: string(128, true),
    },
    {
      tableName: 'payments',
      indexes: [{ unique: true, fields: ['organizationId', 'idempotencyKey'] }],
    },
  ),
  Refund: tenantEntity(
    {
      paymentId: uuid({ tableName: 'payments', key: 'id' }),
      idempotencyKey: string(128),
      amount: money(),
      status: string(32),
      reason: string(500),
      refundedByUserId: uuid({ tableName: 'users', key: 'id' }),
      refundedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'refunds',
      indexes: [{ unique: true, fields: ['organizationId', 'idempotencyKey'] }],
    },
  ),
  CashTransaction: tenantEntity(
    {
      cashShiftId: uuid({ tableName: 'cash_shifts', key: 'id' }),
      paymentId: nullableUuid({ tableName: 'payments', key: 'id' }),
      type: string(32),
      amount: money(),
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      createdByUserId: uuid({ tableName: 'users', key: 'id' }),
    },
    { tableName: 'cash_transactions' },
  ),
  File: tenantEntity(
    {
      orderItemId: nullableUuid({ tableName: 'order_items', key: 'id' }),
      storageKey: { ...string(500), unique: true },
      originalName: string(),
      mimeType: string(128),
      size: { type: DataTypes.BIGINT, allowNull: false },
      checksum: string(128),
      uploadedByUserId: uuid({ tableName: 'users', key: 'id' }),
    },
    { tableName: 'files' },
  ),
  Notification: tenantEntity(
    {
      clientId: nullableUuid({ tableName: 'clients', key: 'id' }),
      type: string(64),
      channel: string(32),
      status: string(32),
      payload: { type: DataTypes.JSONB, allowNull: false },
      sentAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'notifications' },
  ),
  AuditLog: tenantEntity(
    {
      actorUserId: nullableUuid({ tableName: 'users', key: 'id' }),
      action: string(128),
      entityType: string(128),
      entityId: nullableUuid(),
      correlationId: { type: DataTypes.UUID, allowNull: false },
      before: { type: DataTypes.JSONB, allowNull: true },
      after: { type: DataTypes.JSONB, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'audit_logs',
      indexes: [
        { fields: ['organizationId', 'entityType', 'entityId'] },
        { fields: ['organizationId', 'occurredAt'] },
      ],
    },
  ),
  OutboxEvent: tenantEntity(
    {
      aggregateType: string(128),
      aggregateId: uuid(),
      type: string(128),
      payload: { type: DataTypes.JSONB, allowNull: false },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastError: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'outbox_events',
      indexes: [{ fields: ['publishedAt', 'occurredAt'] }],
    },
  ),
  IdempotencyKey: tenantEntity(
    {
      scope: string(128),
      key: string(128),
      requestHash: string(128),
      responseStatus: { type: DataTypes.INTEGER, allowNull: true },
      responseBody: { type: DataTypes.JSONB, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'idempotency_keys',
      indexes: [{ unique: true, fields: ['organizationId', 'scope', 'key'] }],
    },
  ),
}
