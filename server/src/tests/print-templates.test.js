import { describe, expect, it } from 'vitest'

import {
  renderItemTagSvg,
  renderOrderLabelsHtml,
  renderReceiptHtml,
} from '../modules/orders/print-templates.js'

const order = {
  displayNumber: '000015-1',
  status: 'accepted',
  createdAt: '2026-07-24T10:00:00.000Z',
  dueAt: '2026-07-27T10:00:00.000Z',
  subtotalAmount: '123400',
  discountAmount: '0',
  totalAmount: '123400',
  paidAmount: '20000',
  notes: 'Без ароматизатора',
  branch: { name: 'Центральная приёмка' },
  client: { fullName: 'Иван <Петров>', phone: '+7 999 000-00-00' },
  items: [
    {
      id: 'item-1',
      scanCode: 'opaque-scan-code',
      description: 'Светлый ворс',
      quantity: '6.000',
      area: '6.000',
      totalAmount: '123400',
      nomenclature: { name: 'Ковер шерстяной', unit: 'square_meter' },
      material: { name: 'Шерсть' },
      color: { name: 'Бежевый' },
      services: [
        {
          serviceName: 'Деликатная чистка',
          quantity: '6.000',
        },
      ],
    },
  ],
}

describe('print templates', () => {
  it('renders an extensible A4 customer receipt and escapes user data', () => {
    const html = renderReceiptHtml({
      order,
      organization: { name: 'Тестовая химчистка' },
    })

    expect(html).toContain('@page { size: A4')
    expect(html).toContain('ТЕСТОВЫЙ ШАБЛОН')
    expect(html).toContain('Ковер шерстяной')
    expect(html).toContain('Деликатная чистка')
    expect(html).toContain('Тестовая химчистка')
    expect(html).toContain('Иван &lt;Петров&gt;')
    expect(html).not.toContain('Иван <Петров>')
  })

  it('renders exact 55 by 55 millimeter item and order labels', () => {
    const svg = renderItemTagSvg({
      item: order.items[0],
      order,
      qrBase64: 'qr-data',
      barcodeBase64: 'barcode-data',
      index: 1,
    })
    const html = renderOrderLabelsHtml({
      order,
      labels: [
        {
          item: order.items[0],
          qrBase64: 'qr-data',
          barcodeBase64: 'barcode-data',
        },
      ],
    })

    expect(svg).toContain('width="55mm" height="55mm"')
    expect(svg).toContain('Ковер шерстяной')
    expect(html).toContain('@page { size: 55mm 55mm; margin: 0; }')
    expect(html).toContain('Бирки 000015-1: 1 шт.')
  })

  it('marks an unmeasured square-meter position in the customer receipt', () => {
    const html = renderReceiptHtml({
      order: {
        ...order,
        items: [
          {
            ...order.items[0],
            quantity: null,
            area: null,
            length: null,
            width: null,
            totalAmount: '0',
          },
        ],
      },
      organization: { name: 'Тестовая химчистка' },
    })

    expect(html).toContain('Ожидает замера')
  })
})
