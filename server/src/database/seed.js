import { parseEnv } from '../config/env.js'
import { createLogger } from '../config/logger.js'
import { seedDemoOrders } from './demo-orders.js'
import { createSequelize } from './sequelize.js'

const ids = {
  organization: '10000000-0000-4000-8000-000000000001',
  settings: '10000000-0000-4000-8000-000000000002',
  branch: '10000000-0000-4000-8000-000000000003',
  location: '10000000-0000-4000-8000-000000000004',
  workplace: '10000000-0000-4000-8000-000000000005',
  user: '10000000-0000-4000-8000-000000000006',
  role: '10000000-0000-4000-8000-000000000007',
  category: '10000000-0000-4000-8000-000000000008',
  service: '10000000-0000-4000-8000-000000000009',
  garmentType: '10000000-0000-4000-8000-000000000010',
  material: '10000000-0000-4000-8000-000000000011',
  color: '10000000-0000-4000-8000-000000000012',
  defect: '10000000-0000-4000-8000-000000000013',
  contamination: '10000000-0000-4000-8000-000000000014',
  stage: '10000000-0000-4000-8000-000000000015',
  route: '10000000-0000-4000-8000-000000000016',
  routeStage: '10000000-0000-4000-8000-000000000017',
  priceList: '10000000-0000-4000-8000-000000000018',
  priceListItem: '10000000-0000-4000-8000-000000000019',
  nomenclatureCarpet: '10000000-0000-4000-8000-000000000020',
  defectTear: '10000000-0000-4000-8000-000000000021',
  defectZipper: '10000000-0000-4000-8000-000000000022',
  defectUnknownStain: '10000000-0000-4000-8000-000000000023',
  defectGroupClothing: '10000000-0000-4000-8000-000000000024',
  defectGroupCarpets: '10000000-0000-4000-8000-000000000025',
}

const permissionCodes = [
  'clients.view',
  'clients.create',
  'clients.update',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.issue',
  'orders.issue_with_debt',
  'payments.view',
  'payments.create',
  'payments.refund',
  'cash_shifts.manage',
  'discounts.manual',
  'production.view',
  'production.transition',
  'production.assign',
  'production.quality_control',
  'catalog.view',
  'catalog.manage',
  'price_lists.manage',
  'files.view',
  'files.upload',
  'reports.operational',
  'reports.financial',
  'users.manage',
  'roles.manage',
  'settings.manage',
  'audit.view',
]

function permissionId(index) {
  return `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
}

export async function seed(sequelize, logger) {
  const models = sequelize.models

  await sequelize.transaction(async (transaction) => {
    const common = { transaction }
    const organizationDefaults = {
      name: 'Демонстрационная химчистка',
      legalName: 'Демонстрационные данные — не для эксплуатации',
      status: 'active',
      version: 0,
    }
    await models.Organization.findOrCreate({
      where: { id: ids.organization },
      defaults: organizationDefaults,
      ...common,
    })
    await models.OrganizationSettings.findOrCreate({
      where: { id: ids.settings },
      defaults: {
        organizationId: ids.organization,
        locale: 'ru-RU',
        currency: 'RUB',
        timezone: 'Europe/Moscow',
        settings: {},
      },
      ...common,
    })
    await models.Branch.findOrCreate({
      where: { id: ids.branch },
      defaults: {
        organizationId: ids.organization,
        code: 'DEMO',
        name: 'Демонстрационный филиал',
        version: 0,
      },
      ...common,
    })
    await models.Location.findOrCreate({
      where: { id: ids.location },
      defaults: {
        organizationId: ids.organization,
        branchId: ids.branch,
        code: 'RECEPTION',
        name: 'Приёмка',
        type: 'acceptance',
      },
      ...common,
    })
    await models.Workplace.findOrCreate({
      where: { id: ids.workplace },
      defaults: {
        organizationId: ids.organization,
        locationId: ids.location,
        code: 'DESK-1',
        name: 'Рабочее место 1',
        type: 'reception',
      },
      ...common,
    })
    await models.User.findOrCreate({
      where: { id: ids.user },
      defaults: {
        organizationId: ids.organization,
        email: 'owner@example.invalid',
        displayName: 'Демонстрационный владелец',
        passwordHash: null,
        status: 'invited',
        version: 0,
      },
      ...common,
    })
    await models.Role.findOrCreate({
      where: { id: ids.role },
      defaults: {
        organizationId: ids.organization,
        code: 'owner',
        name: 'Владелец',
        system: true,
      },
      ...common,
    })

    await models.UserBranch.findOrCreate({
      where: { userId: ids.user, branchId: ids.branch },
      defaults: { organizationId: ids.organization },
      ...common,
    })
    await models.UserRole.findOrCreate({
      where: { userId: ids.user, roleId: ids.role },
      defaults: { organizationId: ids.organization },
      ...common,
    })

    for (const [index, code] of permissionCodes.entries()) {
      const id = permissionId(index)
      await models.Permission.findOrCreate({
        where: { id },
        defaults: { code, description: null },
        ...common,
      })
      await models.RolePermission.findOrCreate({
        where: { roleId: ids.role, permissionId: id },
        defaults: { organizationId: ids.organization },
        ...common,
      })
    }

    const catalogs = [
      ['ServiceCategory', ids.category, { code: 'CLEANING', name: 'Химчистка' }],
      ['GarmentType', ids.garmentType, { code: 'COAT', name: 'Пальто' }],
      ['Material', ids.material, { code: 'WOOL', name: 'Шерсть' }],
      ['Color', ids.color, { code: 'BLACK', name: 'Чёрный', hex: '#000000' }],
      ['Defect', ids.defect, { code: 'BUTTON_MISSING', name: 'Нет пуговицы' }],
      [
        'Contamination',
        ids.contamination,
        { code: 'GENERAL', name: 'Общее загрязнение' },
      ],
      ['ProductionStage', ids.stage, { code: 'CLEANING', name: 'Чистка' }],
    ]
    for (const [modelName, id, defaults] of catalogs) {
      await models[modelName].findOrCreate({
        where: { id },
        defaults: { organizationId: ids.organization, ...defaults },
        ...common,
      })
    }

    const demoDefects = [
      [ids.defectTear, 'TEAR', 'Порыв'],
      [ids.defectZipper, 'ZIPPER_DAMAGED', 'Повреждена молния или бегунок'],
      [ids.defectUnknownStain, 'UNKNOWN_STAIN', 'Пятна неизвестного происхождения'],
    ]
    for (const [id, code, name] of demoDefects) {
      await models.Defect.findOrCreate({
        where: { id },
        defaults: { organizationId: ids.organization, code, name },
        ...common,
      })
    }
    const defectGroups = [
      [
        ids.defectGroupClothing,
        'Верхняя одежда',
        [ids.defect, ids.defectTear, ids.defectZipper],
      ],
      [
        ids.defectGroupCarpets,
        'Ковры',
        [ids.defectTear, ids.defectUnknownStain],
      ],
    ]
    for (const [id, name, defectIds] of defectGroups) {
      await models.DefectGroup.findOrCreate({
        where: { id },
        defaults: {
          organizationId: ids.organization,
          name,
          version: 0,
        },
        ...common,
      })
      for (const defectId of defectIds) {
        await models.DefectGroupDefect.findOrCreate({
          where: { defectGroupId: id, defectId },
          defaults: { organizationId: ids.organization },
          ...common,
        })
      }
    }

    await models.Service.findOrCreate({
      where: { id: ids.service },
      defaults: {
        organizationId: ids.organization,
        categoryId: ids.category,
        code: 'DRY_CLEAN',
        name: 'Химчистка',
        unit: 'item',
        version: 0,
      },
      ...common,
    })
    await models.ProductionRoute.findOrCreate({
      where: { id: ids.route },
      defaults: {
        organizationId: ids.organization,
        code: 'STANDARD',
        name: 'Стандартный маршрут',
        version: 0,
      },
      ...common,
    })
    await models.ProductionRouteStage.findOrCreate({
      where: { id: ids.routeStage },
      defaults: {
        organizationId: ids.organization,
        routeId: ids.route,
        stageId: ids.stage,
        position: 1,
        required: true,
      },
      ...common,
    })
    await models.PriceList.findOrCreate({
      where: { id: ids.priceList },
      defaults: {
        organizationId: ids.organization,
        name: 'Демонстрационный прайс-лист',
        validFrom: '2026-01-01',
        status: 'active',
        version: 0,
      },
      ...common,
    })
    await models.PriceListItem.findOrCreate({
      where: { id: ids.priceListItem },
      defaults: {
        organizationId: ids.organization,
        priceListId: ids.priceList,
        serviceId: ids.service,
        garmentTypeId: ids.garmentType,
        price: 250000,
      },
      ...common,
    })

    const nomenclatureItems = [
      [
        ids.nomenclatureCarpet,
        'Ковер шерстяной',
        'square_meter',
        'area',
        59000,
        ids.defectGroupCarpets,
      ],
      [
        '50000000-0000-4000-8000-000000000001',
        'Пальто',
        'piece',
        'quantity',
        250000,
        ids.defectGroupClothing,
      ],
      [
        '50000000-0000-4000-8000-000000000002',
        'Куртка',
        'piece',
        'quantity',
        220000,
        ids.defectGroupClothing,
      ],
      [
        '50000000-0000-4000-8000-000000000003',
        'Платье',
        'piece',
        'quantity',
        180000,
        ids.defectGroupClothing,
      ],
      ['50000000-0000-4000-8000-000000000004', 'Шторы', 'linear_meter', 'length', 45000, null],
      ['50000000-0000-4000-8000-000000000005', 'Бельё', 'kilogram', 'weight', 35000, null],
    ]
    for (const [
      index,
      [id, name, unit, calculationType, unitPrice, defectGroupId],
    ] of nomenclatureItems.entries()) {
      const [item] = await models.NomenclatureItem.findOrCreate({
        where: { id },
        defaults: {
          organizationId: ids.organization,
          name,
          unit,
          calculationType,
          unitPrice,
          currency: 'RUB',
          defectGroupId,
          version: 0,
        },
        ...common,
      })
      if (item.defectGroupId !== defectGroupId) {
        await item.update({ defectGroupId }, common)
      }
      await models.PriceListItem.findOrCreate({
        where: {
          id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        },
        defaults: {
          organizationId: ids.organization,
          priceListId: ids.priceList,
          nomenclatureItemId: id,
          price: unitPrice,
        },
        ...common,
      })
    }

    const demoGarments = [
      ['30000000-0000-4000-8000-000000000001', 'JACKET', 'Куртка'],
      ['30000000-0000-4000-8000-000000000002', 'SUIT', 'Костюм'],
      ['30000000-0000-4000-8000-000000000003', 'DRESS', 'Платье'],
      ['30000000-0000-4000-8000-000000000004', 'TROUSERS', 'Брюки'],
      ['30000000-0000-4000-8000-000000000005', 'SHIRT', 'Рубашка'],
      ['30000000-0000-4000-8000-000000000006', 'CARPET', 'Ковёр'],
    ]
    const demoMaterials = [
      ['30000000-0000-4000-8000-000000000011', 'COTTON', 'Хлопок'],
      ['30000000-0000-4000-8000-000000000012', 'SILK', 'Шёлк'],
      ['30000000-0000-4000-8000-000000000013', 'LEATHER', 'Кожа'],
      ['30000000-0000-4000-8000-000000000014', 'SYNTHETIC', 'Синтетика'],
    ]
    const demoColors = [
      ['30000000-0000-4000-8000-000000000021', 'WHITE', 'Белый', '#FFFFFF'],
      ['30000000-0000-4000-8000-000000000022', 'BLUE', 'Синий', '#2457A6'],
      ['30000000-0000-4000-8000-000000000023', 'RED', 'Красный', '#C83C3C'],
      ['30000000-0000-4000-8000-000000000024', 'BEIGE', 'Бежевый', '#D8C3A5'],
    ]
    for (const [id, code, name] of demoGarments) {
      await models.GarmentType.findOrCreate({
        where: { id },
        defaults: { organizationId: ids.organization, code, name },
        ...common,
      })
    }
    for (const [id, code, name] of demoMaterials) {
      await models.Material.findOrCreate({
        where: { id },
        defaults: { organizationId: ids.organization, code, name },
        ...common,
      })
    }
    for (const [id, code, name, hex] of demoColors) {
      await models.Color.findOrCreate({
        where: { id },
        defaults: { organizationId: ids.organization, code, name, hex },
        ...common,
      })
    }

    const demoServices = [
      ['30000000-0000-4000-8000-000000000031', 'WASH', 'Стирка', 'item'],
      ['30000000-0000-4000-8000-000000000032', 'IRON', 'Глажение', 'item'],
      ['30000000-0000-4000-8000-000000000033', 'STAIN_REMOVE', 'Удаление пятен', 'item'],
      [
        '30000000-0000-4000-8000-000000000034',
        'WATER_REPELLENT',
        'Водоотталкивающая пропитка',
        'item',
      ],
    ]
    for (const [id, code, name, unit] of demoServices) {
      await models.Service.findOrCreate({
        where: { id },
        defaults: {
          organizationId: ids.organization,
          categoryId: ids.category,
          code,
          name,
          unit,
          version: 0,
        },
        ...common,
      })
    }

    const allGarments = [[ids.garmentType], ...demoGarments.map(([id]) => [id])]
    const allServices = [
      [ids.service, 250000],
      [demoServices[0][0], 150000],
      [demoServices[1][0], 70000],
      [demoServices[2][0], 90000],
      [demoServices[3][0], 120000],
    ]
    let priceIndex = 1
    for (const [serviceId, basePrice] of allServices) {
      for (const [garmentTypeId] of allGarments) {
        if (serviceId === ids.service && garmentTypeId === ids.garmentType) {
          priceIndex += 1
          continue
        }
        const itemId = `40000000-0000-4000-8000-${String(priceIndex).padStart(12, '0')}`
        await models.PriceListItem.findOrCreate({
          where: { id: itemId },
          defaults: {
            organizationId: ids.organization,
            priceListId: ids.priceList,
            serviceId,
            garmentTypeId,
            price: garmentTypeId === demoGarments[5][0] ? basePrice * 2 : basePrice,
          },
          ...common,
        })
        priceIndex += 1
      }
    }

    await seedDemoOrders(models, ids, transaction)
  })

  logger.info(
    { organizationId: ids.organization, userEmail: 'owner@example.invalid' },
    'safe demonstration data seeded',
  )
}

async function main() {
  const env = parseEnv()
  const logger = createLogger({ environment: env.NODE_ENV, level: env.LOG_LEVEL })
  const sequelize = createSequelize(env, logger)

  try {
    await sequelize.authenticate()
    await seed(sequelize, logger)
  } finally {
    await sequelize.close()
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href
) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
