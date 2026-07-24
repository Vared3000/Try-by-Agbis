const clientId = (index) => `60000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const orderId = (index) => `61000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const itemId = (index) => `62000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const historyId = (index) => `63000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const stageHistoryId = (index) =>
  `64000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const paymentId = (index) => `65000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const issueId = (index) => `66000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const issueItemId = (index) =>
  `67000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const detailId = (index) => `68000000-0000-4000-8000-${String(index).padStart(12, '0')}`

function relativeDate(days, hours = 0) {
  const value = new Date()
  value.setSeconds(0, 0)
  value.setDate(value.getDate() + days)
  value.setHours(value.getHours() + hours)
  return value
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10)
}

function itemTotal({ unitPrice, quantity, length, width }) {
  const measuredQuantity =
    length && width ? Number(length) * Number(width) : Number(length || quantity || 1)
  return String(Math.round(unitPrice * measuredQuantity))
}

const demoClients = [
  {
    fullName: 'Анна Смирнова',
    phone: '+7 916 245-18-40',
    email: 'anna.smirnova@example.invalid',
    notes: 'Предпочитает уведомления по телефону.',
  },
  {
    fullName: 'Михаил Орлов',
    phone: '+7 903 710-42-16',
    email: 'm.orlov@example.invalid',
    notes: 'Постоянный клиент.',
  },
  {
    fullName: 'Елена Волкова',
    phone: '+7 985 330-07-25',
    email: 'volkova.e@example.invalid',
    notes: null,
  },
  {
    fullName: 'Алексей Кузнецов',
    phone: '+7 925 104-63-89',
    email: null,
    notes: 'Проверять карманы при приёмке.',
  },
  {
    fullName: 'Мария Соколова',
    phone: '+7 977 580-21-04',
    email: 'maria.sokolova@example.invalid',
    notes: null,
  },
  {
    fullName: 'Дмитрий Лебедев',
    phone: '+7 909 452-90-11',
    email: null,
    notes: null,
  },
  {
    fullName: 'ООО «Лаванда»',
    phone: '+7 495 120-44-08',
    email: 'office@lavanda.example.invalid',
    notes: 'Корпоративный клиент, шторы и текстиль.',
  },
  {
    fullName: 'Ольга Морозова',
    phone: '+7 926 765-32-10',
    email: 'morozova.o@example.invalid',
    notes: null,
  },
]

export async function seedDemoOrders(models, ids, transaction) {
  const common = { transaction }
  const nomenclature = {
    carpet: ids.nomenclatureCarpet,
    coat: '50000000-0000-4000-8000-000000000001',
    jacket: '50000000-0000-4000-8000-000000000002',
    dress: '50000000-0000-4000-8000-000000000003',
    curtains: '50000000-0000-4000-8000-000000000004',
    linen: '50000000-0000-4000-8000-000000000005',
  }
  const materials = {
    wool: ids.material,
    cotton: '30000000-0000-4000-8000-000000000011',
    silk: '30000000-0000-4000-8000-000000000012',
    synthetic: '30000000-0000-4000-8000-000000000014',
  }
  const colors = {
    black: ids.color,
    white: '30000000-0000-4000-8000-000000000021',
    blue: '30000000-0000-4000-8000-000000000022',
    red: '30000000-0000-4000-8000-000000000023',
    beige: '30000000-0000-4000-8000-000000000024',
  }

  for (const [index, client] of demoClients.entries()) {
    await models.Client.upsert(
      {
        id: clientId(index + 1),
        organizationId: ids.organization,
        ...client,
        archivedAt: null,
        version: 0,
      },
      common,
    )
  }

  const orders = [
    {
      status: 'draft',
      client: 1,
      created: [-0, -2],
      due: [3, 0],
      notes: 'Позвонить перед началом работ.',
      items: [
        {
          nomenclatureItemId: nomenclature.jacket,
          materialId: materials.synthetic,
          colorId: colors.blue,
          status: 'accepted',
          description: 'Куртка с капюшоном, съёмная опушка.',
          quantity: '1',
          unitPrice: 220000,
          contaminated: true,
        },
      ],
    },
    {
      status: 'accepted',
      client: 2,
      created: [-1, -3],
      due: [-1, -2],
      notes: 'Срочный заказ. Просрочен — связаться с производством.',
      items: [
        {
          nomenclatureItemId: nomenclature.coat,
          materialId: materials.wool,
          colorId: colors.black,
          status: 'accepted',
          description: 'Пальто шерстяное, пояс в комплекте.',
          quantity: '1',
          unitPrice: 250000,
          defective: true,
          contaminated: true,
        },
        {
          nomenclatureItemId: nomenclature.dress,
          materialId: materials.silk,
          colorId: colors.red,
          status: 'accepted',
          description: 'Вечернее платье.',
          quantity: '1',
          unitPrice: 180000,
        },
      ],
    },
    {
      status: 'accepted',
      client: 3,
      created: [0, -5],
      due: [0, 8],
      notes: 'Ковёр заберёт курьер после 18:00.',
      items: [
        {
          nomenclatureItemId: nomenclature.carpet,
          materialId: materials.wool,
          colorId: colors.beige,
          status: 'accepted',
          description: 'Ковёр шерстяной, размер 2 × 3 м.',
          quantity: '6',
          length: '2',
          width: '3',
          area: '6',
          unitPrice: 59000,
          contaminated: true,
        },
      ],
    },
    {
      status: 'partially_ready',
      client: 7,
      created: [-2, -4],
      due: [1, 3],
      notes: 'Корпоративный заказ. Выдавать только комплектом.',
      items: [
        {
          nomenclatureItemId: nomenclature.curtains,
          materialId: materials.synthetic,
          colorId: colors.beige,
          status: 'ready',
          description: 'Комплект штор из переговорной.',
          quantity: '6.5',
          length: '6.5',
          unitPrice: 45000,
        },
        {
          nomenclatureItemId: nomenclature.linen,
          materialId: materials.cotton,
          colorId: colors.white,
          status: 'cleaning',
          description: 'Текстиль из зоны ресепшен.',
          quantity: '4.2',
          unitPrice: 35000,
          contaminated: true,
        },
      ],
    },
    {
      status: 'ready',
      client: 5,
      created: [-3, -1],
      due: [0, 2],
      notes: 'Клиенту отправлено уведомление о готовности.',
      paidAmount: 200000,
      items: [
        {
          nomenclatureItemId: nomenclature.jacket,
          materialId: materials.synthetic,
          colorId: colors.black,
          status: 'ready',
          description: 'Демисезонная куртка.',
          quantity: '1',
          unitPrice: 220000,
        },
        {
          nomenclatureItemId: nomenclature.dress,
          materialId: materials.silk,
          colorId: colors.blue,
          status: 'ready',
          description: 'Платье с декоративной отделкой.',
          quantity: '1',
          unitPrice: 180000,
        },
      ],
    },
    {
      status: 'partially_issued',
      client: 4,
      created: [-5, -2],
      due: [-1, 4],
      notes: 'Пальто выдано, куртка ожидает клиента.',
      items: [
        {
          nomenclatureItemId: nomenclature.coat,
          materialId: materials.wool,
          colorId: colors.black,
          status: 'issued',
          description: 'Пальто классическое.',
          quantity: '1',
          unitPrice: 250000,
        },
        {
          nomenclatureItemId: nomenclature.jacket,
          materialId: materials.synthetic,
          colorId: colors.blue,
          status: 'ready',
          description: 'Лёгкая куртка.',
          quantity: '1',
          unitPrice: 220000,
        },
      ],
    },
    {
      status: 'issued',
      client: 6,
      created: [-8, -3],
      due: [-5, 0],
      notes: 'Заказ полностью выдан.',
      items: [
        {
          nomenclatureItemId: nomenclature.coat,
          materialId: materials.wool,
          colorId: colors.beige,
          status: 'issued',
          description: 'Пальто светлое.',
          quantity: '1',
          unitPrice: 250000,
        },
      ],
    },
    {
      status: 'cancelled',
      client: 8,
      created: [-6, -1],
      due: [-3, 2],
      notes: 'Отменено клиентом до начала обработки.',
      items: [
        {
          nomenclatureItemId: nomenclature.dress,
          materialId: materials.silk,
          colorId: colors.red,
          status: 'cancelled',
          description: 'Платье.',
          quantity: '1',
          unitPrice: 180000,
        },
      ],
    },
  ]

  let nextItem = 1
  let nextDetail = 1
  let nextStageHistory = 1
  let nextPayment = 1
  let nextIssue = 1
  let nextOrderSequence =
    BigInt(
      (await models.Order.max('sequence', {
        where: {
          organizationId: ids.organization,
          branchId: ids.branch,
        },
        transaction,
      })) ?? 0,
    ) + 1n

  for (const [orderIndex, order] of orders.entries()) {
    const createdAt = relativeDate(...order.created)
    const dueAt = relativeDate(...order.due)
    const totals = order.items.map(itemTotal)
    const totalAmount = totals.reduce((sum, value) => sum + BigInt(value), 0n)
    const paidAmount =
      order.paidAmount ??
      (['partially_issued', 'issued'].includes(order.status) ? Number(totalAmount) : 0)
    const currentOrderId = orderId(orderIndex + 1)
    const existingOrder = await models.Order.findByPk(currentOrderId, {
      attributes: ['sequence', 'displayNumber'],
      transaction,
    })
    const sequence = existingOrder?.sequence ?? String(nextOrderSequence++)
    const displayNumber =
      existingOrder?.displayNumber ?? `${String(sequence).padStart(6, '0')}-1`

    await models.Order.upsert(
      {
        id: currentOrderId,
        organizationId: ids.organization,
        branchId: ids.branch,
        acceptanceLocationId: ids.location,
        issueLocationId: ids.location,
        clientId: clientId(order.client),
        sequence,
        displayNumber,
        acceptedOn: dateOnly(createdAt),
        dueAt,
        status: order.status,
        subtotalAmount: totalAmount.toString(),
        discountAmount: 0,
        totalAmount: totalAmount.toString(),
        paidAmount: String(paidAmount),
        notes: order.notes,
        createdByUserId: ids.user,
        version: 0,
        createdAt,
      },
      common,
    )

    if (order.status !== 'draft') {
      await models.OrderStatusHistory.upsert(
        {
          id: historyId(orderIndex + 1),
          organizationId: ids.organization,
          orderId: currentOrderId,
          fromStatus: 'draft',
          toStatus: order.status,
          changedByUserId: ids.user,
          reason: 'Демонстрационный сценарий',
          changedAt: relativeDate(order.created[0], order.created[1] + 1),
        },
        common,
      )
    }

    const issuedItems = []
    for (const [orderItemIndex, item] of order.items.entries()) {
      const currentItemId = itemId(nextItem)
      const totalAmountForItem = totals[orderItemIndex]
      await models.OrderItem.upsert(
        {
          id: currentItemId,
          organizationId: ids.organization,
          orderId: currentOrderId,
          scanCode: `DEMO-TAG-${String(nextItem).padStart(4, '0')}`,
          garmentTypeId: null,
          nomenclatureItemId: item.nomenclatureItemId,
          materialId: item.materialId,
          colorId: item.colorId,
          routeId: ids.route,
          status: item.status,
          description: item.description,
          quantity: item.quantity,
          length: item.length ?? null,
          width: item.width ?? null,
          area: item.area ?? null,
          unitPrice: item.unitPrice,
          totalAmount: totalAmountForItem,
          version: 0,
          createdAt: new Date(createdAt.getTime() + orderItemIndex * 60_000),
        },
        common,
      )

      if (item.defective) {
        await models.OrderItemDefect.upsert(
          {
            id: detailId(nextDetail),
            organizationId: ids.organization,
            orderItemId: currentItemId,
            defectId: ids.defect,
            notes: 'Зафиксировано при приёмке',
          },
          common,
        )
        nextDetail += 1
      }
      if (item.contaminated) {
        await models.OrderItemContamination.upsert(
          {
            id: detailId(nextDetail),
            organizationId: ids.organization,
            orderItemId: currentItemId,
            contaminationId: ids.contamination,
            notes: null,
          },
          common,
        )
        nextDetail += 1
      }

      if (['cleaning', 'ready', 'issued'].includes(item.status)) {
        const complete = ['ready', 'issued'].includes(item.status)
        await models.ItemStageHistory.upsert(
          {
            id: stageHistoryId(nextStageHistory),
            organizationId: ids.organization,
            orderItemId: currentItemId,
            stageId: ids.stage,
            status: complete ? 'completed' : 'in_progress',
            workplaceId: ids.workplace,
            assignedUserId: ids.user,
            startedAt: relativeDate(order.created[0], order.created[1] + 2),
            completedAt: complete ? relativeDate(order.due[0], order.due[1] - 1) : null,
            notes: complete ? 'Обработка завершена' : 'На обработке',
          },
          common,
        )
        nextStageHistory += 1
      }
      if (item.status === 'issued') issuedItems.push(currentItemId)
      nextItem += 1
    }

    if (paidAmount > 0) {
      await models.Payment.upsert(
        {
          id: paymentId(nextPayment),
          organizationId: ids.organization,
          orderId: currentOrderId,
          cashShiftId: null,
          idempotencyKey: `demo-payment-${orderIndex + 1}`,
          amount: String(paidAmount),
          method: 'card',
          status: 'completed',
          receivedByUserId: ids.user,
          paidAt: relativeDate(order.created[0], order.created[1] + 1),
          externalReference: `DEMO-${sequence}`,
        },
        common,
      )
      nextPayment += 1
    }

    if (issuedItems.length) {
      const currentIssueId = issueId(nextIssue)
      await models.OrderIssue.upsert(
        {
          id: currentIssueId,
          organizationId: ids.organization,
          orderId: currentOrderId,
          idempotencyKey: `demo-issue-${orderIndex + 1}`,
          issuedByUserId: ids.user,
          issuedAt: relativeDate(order.due[0], order.due[1] + 1),
          notes: 'Демонстрационная выдача',
        },
        common,
      )
      for (const issuedItemId of issuedItems) {
        await models.OrderIssueItem.upsert(
          {
            id: issueItemId(nextIssue),
            organizationId: ids.organization,
            orderIssueId: currentIssueId,
            orderItemId: issuedItemId,
          },
          common,
        )
        nextIssue += 1
      }
    }
  }

  const maximumSequence =
    BigInt(
      (await models.Order.max('sequence', {
        where: {
          organizationId: ids.organization,
          branchId: ids.branch,
        },
        transaction,
      })) ?? 0,
    ) + 1n
  const [sequenceRow] = await models.NumberSequence.findOrCreate({
    where: {
      organizationId: ids.organization,
      branchId: ids.branch,
    },
    defaults: { nextValue: maximumSequence.toString() },
    transaction,
  })
  if (BigInt(sequenceRow.nextValue) < maximumSequence) {
    await sequenceRow.update({ nextValue: maximumSequence.toString() }, { transaction })
  }
}
