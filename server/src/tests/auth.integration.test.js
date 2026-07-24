import { randomUUID } from 'node:crypto'

import argon2 from 'argon2'
import jsQR from 'jsqr'
import pino from 'pino'
import { PNG } from 'pngjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../app.js'
import { parseEnv } from '../config/env.js'
import { createSequelize } from '../database/sequelize.js'
import { createLocalFileStorage } from '../modules/files/local-file-storage.js'

const hasDatabase = Boolean(process.env.DATABASE_URL)
const integration = describe.skipIf(!hasDatabase)

integration('auth API with PostgreSQL', () => {
  const password = 'IntegrationPassword123'
  const suffix = randomUUID().slice(0, 8)
  const ids = {
    organization: randomUUID(),
    otherOrganization: randomUUID(),
    branch: randomUUID(),
    location: randomUUID(),
    workplace: randomUUID(),
    otherBranch: randomUUID(),
    user: randomUUID(),
    role: randomUUID(),
    permission: randomUUID(),
    userBranch: randomUUID(),
    userRole: randomUUID(),
    rolePermission: randomUUID(),
    foreignClient: randomUUID(),
    productionRoute: randomUUID(),
    cleaningStage: randomUUID(),
    qualityStage: randomUUID(),
    packingStage: randomUUID(),
  }
  const email = `auth-${suffix}@example.invalid`
  const permissionCode = `tests.auth.${suffix}`
  let sequelize
  let app
  let testEnv
  let uploadedStorageKey

  beforeAll(async () => {
    testEnv = parseEnv()
    sequelize = createSequelize(testEnv, pino({ level: 'silent' }))
    const models = sequelize.models
    await models.Organization.bulkCreate([
      {
        id: ids.organization,
        name: 'Auth test tenant',
        status: 'active',
        version: 0,
      },
      {
        id: ids.otherOrganization,
        name: 'Other auth test tenant',
        status: 'active',
        version: 0,
      },
    ])
    await models.Branch.bulkCreate([
      {
        id: ids.branch,
        organizationId: ids.organization,
        code: `AUTH-${suffix}`,
        name: 'Assigned branch',
        version: 0,
      },
      {
        id: ids.otherBranch,
        organizationId: ids.otherOrganization,
        code: `OTHER-${suffix}`,
        name: 'Foreign branch',
        version: 0,
      },
    ])
    await models.Location.create({
      id: ids.location,
      organizationId: ids.organization,
      branchId: ids.branch,
      code: `RECEPTION-${suffix}`,
      name: 'Test reception',
      type: 'acceptance',
    })
    await models.Workplace.create({
      id: ids.workplace,
      organizationId: ids.organization,
      locationId: ids.location,
      code: `CASH-${suffix}`,
      name: 'Test cash workplace',
      type: 'cash',
    })
    await models.ProductionStage.bulkCreate([
      {
        id: ids.cleaningStage,
        organizationId: ids.organization,
        code: 'CLEANING',
        name: 'Cleaning',
      },
      {
        id: ids.qualityStage,
        organizationId: ids.organization,
        code: 'QUALITY_CONTROL',
        name: 'Quality control',
      },
      {
        id: ids.packingStage,
        organizationId: ids.organization,
        code: 'PACKING',
        name: 'Packing',
      },
    ])
    await models.ProductionRoute.create({
      id: ids.productionRoute,
      organizationId: ids.organization,
      code: `ROUTE-${suffix}`,
      name: 'Integration route',
      version: 0,
    })
    await models.ProductionRouteStage.bulkCreate(
      [
        [ids.cleaningStage, 1],
        [ids.qualityStage, 2],
        [ids.packingStage, 3],
      ].map(([stageId, position]) => ({
        id: randomUUID(),
        organizationId: ids.organization,
        routeId: ids.productionRoute,
        stageId,
        position,
        required: true,
      })),
    )
    await models.User.create({
      id: ids.user,
      organizationId: ids.organization,
      email,
      displayName: 'Auth integration user',
      passwordHash: await argon2.hash(password),
      status: 'active',
      version: 0,
    })
    await models.Role.create({
      id: ids.role,
      organizationId: ids.organization,
      code: `auth-${suffix}`,
      name: 'Auth test role',
      system: false,
    })
    await models.Permission.create({
      id: ids.permission,
      code: permissionCode,
    })
    await models.UserBranch.create({
      id: ids.userBranch,
      organizationId: ids.organization,
      userId: ids.user,
      branchId: ids.branch,
    })
    await models.UserRole.create({
      id: ids.userRole,
      organizationId: ids.organization,
      userId: ids.user,
      roleId: ids.role,
    })
    await models.RolePermission.create({
      id: ids.rolePermission,
      organizationId: ids.organization,
      roleId: ids.role,
      permissionId: ids.permission,
    })
    const applicationPermissions = await models.Permission.findAll({
      where: {
        code: [
          'clients.view',
          'clients.create',
          'clients.update',
          'catalog.view',
          'catalog.manage',
          'price_lists.manage',
          'orders.view',
          'orders.create',
          'orders.update',
          'files.view',
          'files.upload',
          'payments.view',
          'payments.create',
          'payments.refund',
          'cash_shifts.manage',
          'production.view',
          'production.transition',
          'production.assign',
          'production.quality_control',
          'orders.issue',
          'reports.operational',
          'reports.financial',
          'audit.view',
        ],
      },
    })
    await models.RolePermission.bulkCreate(
      applicationPermissions.map((permission) => ({
        id: randomUUID(),
        organizationId: ids.organization,
        roleId: ids.role,
        permissionId: permission.id,
      })),
    )
    await models.Client.create({
      id: ids.foreignClient,
      organizationId: ids.otherOrganization,
      fullName: 'Foreign tenant client',
      version: 0,
    })
    app = createApp({
      environment: 'test',
      logger: pino({ level: 'silent' }),
      readyCheck: () => sequelize.authenticate(),
      sequelize,
      env: testEnv,
    })
  })

  afterAll(async () => {
    if (!sequelize) return
    const models = sequelize.models
    await models.RefreshSession.destroy({ where: { userId: ids.user }, force: true })
    await models.ItemStageHistory.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OrderIssueItem.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OrderIssue.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Notification.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OutboxEvent.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    if (uploadedStorageKey) {
      await createLocalFileStorage(testEnv.FILE_STORAGE_PATH).delete(uploadedStorageKey)
    }
    await models.File.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.CashTransaction.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Refund.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Payment.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.CashShift.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.AuditLog.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OrderStatusHistory.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.IdempotencyKey.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OrderItemService.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.OrderItem.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Order.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.NomenclatureItem.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.NumberSequence.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.PriceListItem.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.PriceList.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Service.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ServiceCategory.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.GarmentType.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ProductionRouteStage.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ProductionRoute.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ProductionStage.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ClientConsent.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.ClientAddress.destroy({
      where: { organizationId: ids.organization },
      force: true,
    })
    await models.Client.destroy({
      where: { organizationId: [ids.organization, ids.otherOrganization] },
      force: true,
    })
    await models.RolePermission.destroy({
      where: { roleId: ids.role },
      force: true,
    })
    await models.UserRole.destroy({ where: { id: ids.userRole }, force: true })
    await models.UserBranch.destroy({ where: { id: ids.userBranch }, force: true })
    await models.Permission.destroy({ where: { id: ids.permission }, force: true })
    await models.Role.destroy({ where: { id: ids.role }, force: true })
    await models.User.destroy({ where: { id: ids.user }, force: true })
    await models.Workplace.destroy({ where: { id: ids.workplace }, force: true })
    await models.Location.destroy({ where: { id: ids.location }, force: true })
    await models.Branch.destroy({
      where: { id: [ids.branch, ids.otherBranch] },
      force: true,
    })
    await models.Organization.destroy({
      where: { id: [ids.organization, ids.otherOrganization] },
      force: true,
    })
    await sequelize.close()
  })

  it('rejects invalid credentials without exposing the account state', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword123' })
      .expect(401)

    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('logs in and exposes only assigned tenant access', async () => {
    const agent = request.agent(app)
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200)

    expect(login.body.data.accessToken).toBeTruthy()
    expect(login.body.data.user).toMatchObject({
      id: ids.user,
      organizationId: ids.organization,
      branchIds: [ids.branch],
    })
    expect(login.body.data.user.permissions).toContain(permissionCode)
    expect(login.body.data.user.branchIds).not.toContain(ids.otherBranch)

    const me = await agent
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200)
    expect(me.body.data.organizationId).toBe(ids.organization)
    expect(me.body.data.displayName).toBe('Auth integration user')

    const context = await agent
      .get('/api/v1/auth/context')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200)
    expect(context.body.data.branches).toHaveLength(1)
    expect(context.body.data.branches[0].id).toBe(ids.branch)
    expect(context.body.data.branches[0].locations[0].id).toBe(ids.location)
  })

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const originalCookie = login.headers['set-cookie'][0].split(';')[0]

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200)
    const rotatedCookie = refreshed.headers['set-cookie'][0].split(';')[0]
    expect(rotatedCookie).not.toBe(originalCookie)

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe('AUTH_REFRESH_REUSED')
      })

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(401)
  })

  it('creates client data and hides a client from another tenant', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`

    const created = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', authorization)
      .send({ fullName: 'Integration Client', phone: '+79990000000' })
      .expect(201)
    const clientId = created.body.data.id

    await request(app)
      .post(`/api/v1/clients/${clientId}/addresses`)
      .set('Authorization', authorization)
      .send({ address: 'Test address', isPrimary: true })
      .expect(201)

    await request(app)
      .post(`/api/v1/clients/${clientId}/consents`)
      .set('Authorization', authorization)
      .send({
        type: 'personal_data',
        textVersion: '1',
        granted: true,
        channel: 'paper',
      })
      .expect(201)

    const list = await request(app)
      .get('/api/v1/clients?search=Integration')
      .set('Authorization', authorization)
      .expect(200)
    expect(list.body.data.map(({ id }) => id)).toContain(clientId)

    await request(app)
      .get(`/api/v1/clients/${ids.foreignClient}`)
      .set('Authorization', authorization)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CLIENT_NOT_FOUND')
      })
  })

  it('manages catalog services and price list items inside the tenant', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`

    const category = await request(app)
      .post('/api/v1/catalog/service-categories')
      .set('Authorization', authorization)
      .send({ code: `CATEGORY_${suffix}`, name: 'Test category' })
      .expect(201)
    const garment = await request(app)
      .post('/api/v1/catalog/garment-types')
      .set('Authorization', authorization)
      .send({ code: `GARMENT_${suffix}`, name: 'Test garment' })
      .expect(201)
    const service = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authorization)
      .send({
        categoryId: category.body.data.id,
        code: `SERVICE_${suffix}`,
        name: 'Test service',
        unit: 'item',
      })
      .expect(201)
    const priceList = await request(app)
      .post('/api/v1/price-lists')
      .set('Authorization', authorization)
      .send({
        name: 'Test price list',
        validFrom: '2026-01-01',
        status: 'active',
      })
      .expect(201)

    const priceItem = await request(app)
      .post(`/api/v1/price-lists/${priceList.body.data.id}/items`)
      .set('Authorization', authorization)
      .send({
        serviceId: service.body.data.id,
        garmentTypeId: garment.body.data.id,
        price: '120000',
      })
      .expect(201)

    const updatedPrice = await request(app)
      .patch(
        `/api/v1/price-lists/${priceList.body.data.id}/items/${priceItem.body.data.id}`,
      )
      .set('Authorization', authorization)
      .send({ price: '123400' })
      .expect(200)
    expect(updatedPrice.body.data.price).toBe('123400')

    const genericPrice = await request(app)
      .post(`/api/v1/price-lists/${priceList.body.data.id}/items`)
      .set('Authorization', authorization)
      .send({
        serviceId: service.body.data.id,
        garmentTypeId: null,
        price: '99900',
      })
      .expect(201)
    await request(app)
      .delete(
        `/api/v1/price-lists/${priceList.body.data.id}/items/${genericPrice.body.data.id}`,
      )
      .set('Authorization', authorization)
      .expect(200)

    const details = await request(app)
      .get(`/api/v1/price-lists/${priceList.body.data.id}`)
      .set('Authorization', authorization)
      .expect(200)
    expect(details.body.data.items).toHaveLength(1)
    expect(details.body.data.items[0].price).toBe('123400')
    expect(details.body.data.items[0].service.organizationId).toBe(ids.organization)
  })

  it('creates and accepts an order with immutable service price snapshot', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`
    const client = await sequelize.models.Client.findOne({
      where: { organizationId: ids.organization },
    })
    const garment = await sequelize.models.GarmentType.findOne({
      where: { organizationId: ids.organization },
    })
    const service = await sequelize.models.Service.findOne({
      where: { organizationId: ids.organization },
    })

    await sequelize.models.Order.create({
      id: randomUUID(),
      organizationId: ids.organization,
      branchId: ids.branch,
      acceptanceLocationId: ids.location,
      clientId: client.id,
      sequence: '1',
      displayNumber: 'RECEPTION-20250101-1-1',
      acceptedOn: '2025-01-01',
      dueAt: null,
      status: 'issued',
      subtotalAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      notes: 'Previous business day order',
      createdByUserId: ids.user,
      version: 0,
    })

    const order = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', authorization)
      .send({
        branchId: ids.branch,
        acceptanceLocationId: ids.location,
        clientId: client.id,
      })
      .expect(201)
    expect(order.body.data.displayNumber).toMatch(/^RECEPTION-/)
    expect(order.body.data.sequence).toBe('1')
    expect(order.body.data.displayNumber).not.toBe('RECEPTION-20250101-1-1')

    const updatedOrder = await request(app)
      .patch(`/api/v1/orders/${order.body.data.id}`)
      .set('Authorization', authorization)
      .send({
        clientId: client.id,
        dueAt: '2026-08-01T12:00:00.000Z',
        notes: 'Integration reception note',
      })
      .expect(200)
    expect(updatedOrder.body.data.notes).toBe('Integration reception note')

    const item = await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/items`)
      .set('Authorization', authorization)
      .send({
        garmentTypeId: garment.id,
        routeId: ids.productionRoute,
        description: 'Test garment',
      })
      .expect(201)
    expect(item.body.data.scanCode).toBeTruthy()

    const snapshot = await request(app)
      .post(`/api/v1/orders/items/${item.body.data.id}/services`)
      .set('Authorization', authorization)
      .send({ serviceId: service.id, quantity: '1.000' })
      .expect(201)
    expect(snapshot.body.data.totalPrice).toBe('123400')

    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/accept`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `accept-${suffix}`)
      .expect(200)

    await request(app)
      .patch(`/api/v1/orders/${order.body.data.id}`)
      .set('Authorization', authorization)
      .send({ notes: 'Must stay immutable' })
      .expect(409)

    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/accept`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `accept-${suffix}`)
      .expect(200)

    const details = await request(app)
      .get(`/api/v1/orders/${order.body.data.id}`)
      .set('Authorization', authorization)
      .expect(200)
    expect(details.body.data.status).toBe('accepted')
    expect(details.body.data.totalAmount).toBe('123400')
    expect(details.body.data.items[0].services[0].serviceName).toBe('Test service')

    const clientOrders = await request(app)
      .get(`/api/v1/clients/${client.id}/orders`)
      .set('Authorization', authorization)
      .expect(200)
    expect(clientOrders.body.data.map(({ id }) => id)).toContain(order.body.data.id)

    const receipt = await request(app)
      .get(`/api/v1/orders/${order.body.data.id}/receipt`)
      .set('Authorization', authorization)
      .expect('Content-Type', /html/)
      .expect(200)
    expect(receipt.text).toContain('ТЕСТОВЫЙ ШАБЛОН')
    expect(receipt.text).toContain('Integration Client')
    expect(receipt.text).toContain('Test service')

    const orderLabels = await request(app)
      .get(`/api/v1/orders/${order.body.data.id}/labels`)
      .set('Authorization', authorization)
      .expect('Content-Type', /html/)
      .expect(200)
    expect(orderLabels.text).toContain('@page { size: 55mm 55mm; margin: 0; }')
    expect(orderLabels.text).toContain(order.body.data.displayNumber)

    const label = await request(app)
      .get(`/api/v1/order-items/${item.body.data.id}/labels`)
      .set('Authorization', authorization)
      .expect(200)
    expect(label.body.data.scanCode).toBe(item.body.data.scanCode)
    expect(label.body.data.symbologies).toEqual(['qr', 'code128'])

    const qr = await request(app)
      .get(`/api/v1/order-items/${item.body.data.id}/labels?symbology=qr&output=svg`)
      .set('Authorization', authorization)
      .expect('Content-Type', /svg/)
      .expect(200)
    expect(qr.body.toString()).toContain('<svg')

    const qrPng = await request(app)
      .get(`/api/v1/order-items/${item.body.data.id}/labels?symbology=qr&output=png`)
      .set('Authorization', authorization)
      .expect('Content-Type', /png/)
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(200)
    const decodedPng = PNG.sync.read(qrPng.body)
    const decodedQr = jsQR(
      new Uint8ClampedArray(
        decodedPng.data.buffer,
        decodedPng.data.byteOffset,
        decodedPng.data.byteLength,
      ),
      decodedPng.width,
      decodedPng.height,
    )
    expect(decodedPng.width).toBe(512)
    expect(decodedPng.height).toBe(512)
    expect(decodedQr?.data).toBe(item.body.data.scanCode)
    expect(decodedQr?.data).not.toContain('Integration Client')
    expect(decodedQr?.data).not.toContain('+79990000000')

    const tag = await request(app)
      .get(`/api/v1/order-items/${item.body.data.id}/labels?layout=tag`)
      .set('Authorization', authorization)
      .expect('Content-Type', /svg/)
      .expect(200)
    expect(tag.body.toString()).toContain('width="55mm" height="55mm"')
    expect(tag.body.toString()).toContain(order.body.data.displayNumber)

    const barcode = await request(app)
      .get(`/api/v1/order-items/${item.body.data.id}/labels?symbology=code128&output=png`)
      .set('Authorization', authorization)
      .expect('Content-Type', /png/)
      .expect(200)
    expect(barcode.body.subarray(1, 4).toString()).toBe('PNG')

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const uploaded = await request(app)
      .post('/api/v1/files')
      .set('Authorization', authorization)
      .field('orderItemId', item.body.data.id)
      .attach('file', png, { filename: 'test.png', contentType: 'image/png' })
      .expect(201)
    uploadedStorageKey = uploaded.body.data.storageKey

    const downloaded = await request(app)
      .get(`/api/v1/files/${uploaded.body.data.id}`)
      .set('Authorization', authorization)
      .expect('Content-Type', /png/)
      .expect(200)
    expect(Buffer.compare(downloaded.body, png)).toBe(0)

    const orderWithFiles = await request(app)
      .get(`/api/v1/orders/${order.body.data.id}`)
      .set('Authorization', authorization)
      .expect(200)
    expect(orderWithFiles.body.data.items[0].files[0].id).toBe(uploaded.body.data.id)

    await request(app)
      .delete(`/api/v1/files/${uploaded.body.data.id}`)
      .set('Authorization', authorization)
      .expect(409)
  })

  it('processes idempotent cash payment, bounded refund and shift closing', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`
    const order = await sequelize.models.Order.findOne({
      where: { organizationId: ids.organization, status: 'accepted' },
      order: [['createdAt', 'DESC']],
    })

    const noCurrentShift = await request(app)
      .get('/api/v1/cash-shifts/current')
      .query({ branchId: ids.branch })
      .set('Authorization', authorization)
      .expect(200)
    expect(noCurrentShift.body.data).toBeNull()

    const shift = await request(app)
      .post('/api/v1/cash-shifts')
      .set('Authorization', authorization)
      .send({
        branchId: ids.branch,
        workplaceId: ids.workplace,
        openingAmount: '10000',
      })
      .expect(201)

    const currentShift = await request(app)
      .get('/api/v1/cash-shifts/current')
      .query({ branchId: ids.branch })
      .set('Authorization', authorization)
      .expect(200)
    expect(currentShift.body.data.id).toBe(shift.body.data.id)

    const paymentRequest = () =>
      request(app)
        .post(`/api/v1/orders/${order.id}/payments`)
        .set('Authorization', authorization)
        .set('Idempotency-Key', `payment-${suffix}`)
        .send({
          amount: '100000',
          method: 'cash',
          cashShiftId: shift.body.data.id,
        })
    const [payment, repeatedPayment] = await Promise.all([
      paymentRequest().expect(201),
      paymentRequest().expect(201),
    ])
    expect(repeatedPayment.body.data.id).toBe(payment.body.data.id)

    const refundRequest = (amount = '40000') =>
      request(app)
        .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
        .set('Authorization', authorization)
        .set('Idempotency-Key', `refund-${suffix}`)
        .send({
          amount,
          reason: 'Integration refund',
          cashShiftId: shift.body.data.id,
        })
    const [refund, repeatedRefund] = await Promise.all([
      refundRequest().expect(201),
      refundRequest().expect(201),
    ])
    expect(repeatedRefund.body.data.id).toBe(refund.body.data.id)

    await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `refund-over-${suffix}`)
      .send({
        amount: '60001',
        reason: 'Must fail',
        cashShiftId: shift.body.data.id,
      })
      .expect(422)

    const closed = await request(app)
      .post(`/api/v1/cash-shifts/${shift.body.data.id}/close`)
      .set('Authorization', authorization)
      .expect(200)
    expect(closed.body.data.closingAmount).toBe('70000')

    const noShiftAfterClosing = await request(app)
      .get('/api/v1/cash-shifts/current')
      .query({ branchId: ids.branch })
      .set('Authorization', authorization)
      .expect(200)
    expect(noShiftAfterClosing.body.data).toBeNull()

    await order.reload()
    expect(order.paidAmount).toBe('60000')
  })

  it('scans and completes a production route with quality rework', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`
    const routes = await request(app)
      .get('/api/v1/production/routes')
      .set('Authorization', authorization)
      .expect(200)
    expect(routes.body.data[0].stages).toHaveLength(3)
    const item = await sequelize.models.OrderItem.findOne({
      where: { organizationId: ids.organization },
      order: [['createdAt', 'DESC']],
    })

    const queue = await request(app)
      .get('/api/v1/production/items')
      .query({ search: item.scanCode })
      .set('Authorization', authorization)
      .expect(200)
    expect(queue.body.meta.total).toBe(1)
    expect(queue.body.data[0].id).toBe(item.id)
    expect(queue.body.data[0].order.client.fullName).toBeTruthy()

    const scan = await request(app)
      .get(`/api/v1/production/items/scan/${item.scanCode}`)
      .set('Authorization', authorization)
      .expect(200)
    expect(scan.body.data.id).toBe(item.id)
    expect(scan.body.data.order.client.fullName).toBeTruthy()

    const transition = (stageId, action) =>
      request(app)
        .post(`/api/v1/order-items/${item.id}/transition`)
        .set('Authorization', authorization)
        .send({ stageId, action, workplaceId: ids.workplace })

    await transition(ids.cleaningStage, 'start').expect(200)
    const cleaningQueue = await request(app)
      .get('/api/v1/production/items')
      .query({ search: item.scanCode, status: 'cleaning' })
      .set('Authorization', authorization)
      .expect(200)
    expect(cleaningQueue.body.data[0].id).toBe(item.id)
    await request(app)
      .post(`/api/v1/order-items/${item.id}/assign`)
      .set('Authorization', authorization)
      .send({ userId: ids.user, workplaceId: ids.workplace })
      .expect(200)
    await transition(ids.cleaningStage, 'complete').expect(200)
    await transition(ids.qualityStage, 'start').expect(200)
    await transition(ids.qualityStage, 'rework').expect(200)
    await transition(ids.cleaningStage, 'start').expect(200)
    await transition(ids.cleaningStage, 'complete').expect(200)
    await transition(ids.qualityStage, 'start').expect(200)
    await transition(ids.qualityStage, 'complete').expect(200)
    await transition(ids.packingStage, 'start').expect(200)
    await transition(ids.packingStage, 'complete').expect(200)

    await item.reload()
    expect(item.status).toBe('ready')
    const order = await sequelize.models.Order.findByPk(item.orderId)
    expect(order.status).toBe('ready')
  })

  it('blocks debt, then issues exactly once and exposes reports', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`
    const item = await sequelize.models.OrderItem.findOne({
      where: { organizationId: ids.organization, status: 'ready' },
    })
    const issueRequest = () =>
      request(app)
        .post(`/api/v1/orders/${item.orderId}/issues`)
        .set('Authorization', authorization)
        .set('Idempotency-Key', `issue-${suffix}`)
        .send({ itemIds: [item.id] })

    await issueRequest()
      .expect(422)
      .expect(({ body }) => {
        expect(body.error.code).toBe('PAYMENT_REQUIRED')
      })

    await request(app)
      .post(`/api/v1/orders/${item.orderId}/payments`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `final-payment-${suffix}`)
      .send({ amount: '63400', method: 'card' })
      .expect(201)

    const [issued, replayed] = await Promise.all([
      issueRequest().expect(201),
      issueRequest().expect(201),
    ])
    expect(issued.body.data.issueId).toBe(replayed.body.data.issueId)

    await item.reload()
    expect(item.status).toBe('issued')
    const order = await sequelize.models.Order.findByPk(item.orderId)
    expect(order.status).toBe('issued')

    const operational = await request(app)
      .get('/api/v1/reports/operational')
      .set('Authorization', authorization)
      .expect(200)
    expect(operational.body.data.byStatus.issued).toBeGreaterThanOrEqual(1)

    const financial = await request(app)
      .get('/api/v1/reports/financial')
      .set('Authorization', authorization)
      .expect(200)
    expect(financial.body.data.netAmount).toBe('123400')

    await request(app)
      .get('/api/v1/reports/operational?format=csv')
      .set('Authorization', authorization)
      .expect('Content-Type', /csv/)
      .expect(200)

    const audit = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', authorization)
      .expect(200)
    expect(audit.body.data.some(({ action }) => action === 'order.issued')).toBe(true)
  })

  it('calculates a square-meter nomenclature position inside an order', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    const authorization = `Bearer ${login.body.data.accessToken}`
    const position = await request(app)
      .post('/api/v1/nomenclature')
      .set('Authorization', authorization)
      .send({
        name: 'Integration wool carpet',
        unit: 'square_meter',
        unitPrice: '59000',
      })
      .expect(201)
    expect(position.body.data.calculationType).toBe('area')

    const client = await sequelize.models.Client.findOne({
      where: { organizationId: ids.organization },
    })
    const order = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', authorization)
      .send({
        branchId: ids.branch,
        acceptanceLocationId: ids.location,
        clientId: client.id,
      })
      .expect(201)
    const item = await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/items`)
      .set('Authorization', authorization)
      .send({
        nomenclatureItemId: position.body.data.id,
      })
      .expect(201)
    expect(item.body.data.area).toBeNull()
    expect(item.body.data.quantity).toBeNull()
    expect(item.body.data.unitPrice).toBe('59000')
    expect(item.body.data.totalAmount).toBe('0')
    expect(item.body.data.routeId).toBe(ids.productionRoute)

    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/accept`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `accept-area-${suffix}`)
      .expect(200)

    const measurement = await request(app)
      .patch(`/api/v1/order-items/${item.body.data.id}/measurements`)
      .set('Authorization', authorization)
      .send({ length: '2', width: '3' })
      .expect(200)
    expect(measurement.body.data.item.area).toBe('6.000')
    expect(measurement.body.data.item.totalAmount).toBe('354000')
    expect(measurement.body.data.order.totalAmount).toBe('354000')

    const details = await request(app)
      .get(`/api/v1/orders/${order.body.data.id}`)
      .set('Authorization', authorization)
      .expect(200)
    expect(details.body.data.status).toBe('accepted')
    expect(details.body.data.totalAmount).toBe('354000')
    expect(details.body.data.items[0].nomenclature.name).toBe('Integration wool carpet')

    for (const stageId of [ids.cleaningStage, ids.qualityStage, ids.packingStage]) {
      await request(app)
        .post(`/api/v1/order-items/${item.body.data.id}/transition`)
        .set('Authorization', authorization)
        .send({ stageId, action: 'start', workplaceId: ids.workplace })
        .expect(200)
      await request(app)
        .post(`/api/v1/order-items/${item.body.data.id}/transition`)
        .set('Authorization', authorization)
        .send({ stageId, action: 'complete', workplaceId: ids.workplace })
        .expect(200)
    }

    const issueWithDebtPermission = await sequelize.models.Permission.findOne({
      where: { code: 'orders.issue_with_debt' },
    })
    await sequelize.models.RolePermission.create({
      id: randomUUID(),
      organizationId: ids.organization,
      roleId: ids.role,
      permissionId: issueWithDebtPermission.id,
    })
    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/issues`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', `issue-area-${suffix}`)
      .send({
        itemIds: [item.body.data.id],
        paymentOverrideReason: 'Integration manager approval',
      })
      .expect(201)

    const issuedOrder = await sequelize.models.Order.findByPk(order.body.data.id)
    expect(issuedOrder.status).toBe('issued')
  })
})
