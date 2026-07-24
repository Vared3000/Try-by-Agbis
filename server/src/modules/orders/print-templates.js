const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const money = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(Number(value || 0) / 100)

const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Не указан'

const unitLabels = {
  piece: 'шт.',
  square_meter: 'м²',
  linear_meter: 'пог. м',
  kilogram: 'кг',
}

const orderStatusLabels = {
  draft: 'Черновик',
  accepted: 'Принят',
  in_progress: 'В работе',
  partially_ready: 'Частично готов',
  ready: 'Готов',
  partially_issued: 'Частично выдан',
  issued: 'Выдан',
  cancelled: 'Отменён',
}

const itemTitle = (item) =>
  item.nomenclature?.name ||
  item.garmentType?.name ||
  item.description ||
  `Изделие ${item.scanCode}`

const itemQuantity = (item) => {
  if (item.area) return `${item.area} м²`
  if (item.quantity) {
    return `${item.quantity} ${unitLabels[item.nomenclature?.unit] || ''}`.trim()
  }
  if (['square_meter', 'linear_meter'].includes(item.nomenclature?.unit)) {
    return 'Ожидает замера'
  }
  return '1 шт.'
}

const printToolbar = (title) => `<div class="print-toolbar">
  <strong>${escapeHtml(title)}</strong>
  <span>Проверьте масштаб 100% в настройках печати</span>
  <button type="button" onclick="window.print()">Печать</button>
</div>`

export const defaultReceiptTemplate = Object.freeze({
  documentTitle: 'Квитанция о приёме заказа',
  brandName: 'CleanFlow',
  legalDetails: 'Тестовые реквизиты организации — заполнить перед запуском',
  address: 'Адрес точки приёма — заполнить позднее',
  phone: 'Телефон — заполнить позднее',
  footer:
    'Тестовый текст условий оказания услуг. В дальнейшем здесь можно разместить правила приёма, хранения, обработки персональных данных и подписи сторон.',
})

export function renderReceiptHtml({
  order,
  organization,
  template = defaultReceiptTemplate,
}) {
  const companyName = organization?.name || template.brandName
  const rows = (order.items ?? [])
    .map((item, index) => {
      const services = (item.services ?? [])
        .map(
          (service) =>
            `${escapeHtml(service.serviceName)} × ${escapeHtml(service.quantity)}`,
        )
        .join('<br>')
      const details = [
        item.material?.name && `Материал: ${escapeHtml(item.material.name)}`,
        item.color?.name && `Цвет: ${escapeHtml(item.color.name)}`,
        item.length &&
          item.width &&
          `Размер: ${escapeHtml(item.length)} × ${escapeHtml(item.width)} м`,
      ]
        .filter(Boolean)
        .join('<br>')
      return `<tr>
        <td>${index + 1}</td>
        <td>
          <strong>${escapeHtml(itemTitle(item))}</strong>
          ${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}
          ${details ? `<small>${details}</small>` : ''}
        </td>
        <td>${services || 'Базовая обработка'}</td>
        <td>${escapeHtml(itemQuantity(item))}</td>
        <td class="money">${escapeHtml(money(item.totalAmount))}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Квитанция ${escapeHtml(order.displayNumber)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17231d; background: #eef2ef; font: 12px/1.45 Arial, sans-serif; }
    .print-toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 18px;
      padding: 12px 18px; color: #fff; background: #173d30; }
    .print-toolbar span { flex: 1; opacity: .75; }
    .print-toolbar button { border: 0; border-radius: 8px; padding: 9px 18px; font-weight: 700; cursor: pointer; }
    .sheet { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 12mm;
      background: #fff; box-shadow: 0 8px 35px #173d3020; }
    .test-mark { margin-bottom: 8mm; padding: 7px 10px; border: 1px dashed #b98b19;
      color: #725204; background: #fff8dc; text-align: center; font-weight: 700; letter-spacing: .08em; }
    header { display: flex; justify-content: space-between; gap: 20mm; padding-bottom: 6mm; border-bottom: 2px solid #173d30; }
    h1 { margin: 0 0 2mm; font-size: 23px; } h2 { margin: 0; font-size: 15px; }
    .company { text-align: right; } .company strong { display: block; font-size: 18px; }
    .muted, small { display: block; color: #65746c; font-size: 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 12mm; margin: 7mm 0; }
    .meta div { padding-bottom: 2mm; border-bottom: 1px solid #dfe5e1; }
    .meta span { display: block; color: #65746c; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 2.5mm 2mm; color: #fff; background: #315d4d; text-align: left; font-size: 10px; }
    td { padding: 3mm 2mm; border-bottom: 1px solid #dfe5e1; vertical-align: top; }
    td:first-child { width: 8mm; } .money { white-space: nowrap; text-align: right; font-weight: 700; }
    .totals { width: 75mm; margin: 7mm 0 7mm auto; }
    .totals div { display: flex; justify-content: space-between; padding: 2mm 0; border-bottom: 1px solid #dfe5e1; }
    .totals .total { font-size: 16px; font-weight: 700; border-bottom: 2px solid #173d30; }
    .notes, .terms { margin-top: 6mm; padding: 4mm; border: 1px solid #dfe5e1; border-radius: 3mm; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 15mm; margin-top: 15mm; }
    .signature { padding-top: 8mm; border-bottom: 1px solid #17231d; color: #65746c; font-size: 10px; }
    @media print {
      body { background: #fff; } .print-toolbar { display: none; }
      .sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${printToolbar(`Квитанция ${order.displayNumber}`)}
  <main class="sheet">
    <div class="test-mark">ТЕСТОВЫЙ ШАБЛОН — РЕКВИЗИТЫ И УСЛОВИЯ БУДУТ ДОПОЛНЕНЫ</div>
    <header>
      <div>
        <h1>${escapeHtml(template.documentTitle)}</h1>
        <h2>Заказ № ${escapeHtml(order.displayNumber)}</h2>
        <span class="muted">Статус: ${escapeHtml(orderStatusLabels[order.status] || order.status)}</span>
      </div>
      <div class="company">
        <strong>${escapeHtml(companyName)}</strong>
        <span>${escapeHtml(template.legalDetails)}</span>
        <span>${escapeHtml(order.branch?.name || template.address)}</span>
        <span>${escapeHtml(template.phone)}</span>
      </div>
    </header>
    <section class="meta">
      <div><span>Дата приёма</span><strong>${escapeHtml(dateTime(order.createdAt))}</strong></div>
      <div><span>Срок готовности</span><strong>${escapeHtml(dateTime(order.dueAt))}</strong></div>
      <div><span>Клиент</span><strong>${escapeHtml(order.client?.fullName)}</strong></div>
      <div><span>Телефон</span><strong>${escapeHtml(order.client?.phone || 'Не указан')}</strong></div>
    </section>
    <table>
      <thead><tr><th>№</th><th>Изделие</th><th>Услуга</th><th>Количество</th><th>Стоимость</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Позиции ещё не добавлены</td></tr>'}</tbody>
    </table>
    <section class="totals">
      <div><span>Сумма</span><strong>${escapeHtml(money(order.subtotalAmount))}</strong></div>
      <div><span>Скидка</span><strong>${escapeHtml(money(order.discountAmount))}</strong></div>
      <div class="total"><span>Итого</span><strong>${escapeHtml(money(order.totalAmount))}</strong></div>
      <div><span>Оплачено</span><strong>${escapeHtml(money(order.paidAmount))}</strong></div>
      <div><span>К оплате</span><strong>${escapeHtml(money(Number(order.totalAmount) - Number(order.paidAmount)))}</strong></div>
    </section>
    ${order.notes ? `<section class="notes"><strong>Комментарий к заказу</strong><p>${escapeHtml(order.notes)}</p></section>` : ''}
    <section class="terms"><strong>Условия оказания услуг</strong><p>${escapeHtml(template.footer)}</p></section>
    <section class="signatures">
      <div class="signature">Заказ принял / подпись</div>
      <div class="signature">Клиент / подпись</div>
    </section>
  </main>
</body>
</html>`
}

export function renderItemTagSvg({ item, order, qrBase64, barcodeBase64, index }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="55mm" height="55mm" viewBox="0 0 55 55">
  <rect width="55" height="55" fill="#fff"/>
  <text x="3" y="4.2" font-family="Arial, sans-serif" font-size="3.1" font-weight="700">${escapeHtml(order.displayNumber)}</text>
  <text x="52" y="4.2" text-anchor="end" font-family="Arial, sans-serif" font-size="2.7">№ ${escapeHtml(index || 1)}</text>
  <text x="27.5" y="8" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.7">${escapeHtml(itemTitle(item).slice(0, 36))}</text>
  <image x="11.5" y="9" width="32" height="32" href="data:image/png;base64,${qrBase64}"/>
  <image x="3.5" y="42" width="48" height="7" preserveAspectRatio="none" href="data:image/png;base64,${barcodeBase64}"/>
  <text x="27.5" y="52.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="2">${escapeHtml(item.scanCode)}</text>
</svg>`
}

export function renderOrderLabelsHtml({ order, labels }) {
  const pages = labels
    .map(
      ({ item, qrBase64, barcodeBase64 }, index) => `<section class="tag">
        ${renderItemTagSvg({
          item,
          order,
          qrBase64,
          barcodeBase64,
          index: index + 1,
        })}
      </section>`,
    )
    .join('')

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Бирки ${escapeHtml(order.displayNumber)}</title>
  <style>
    @page { size: 55mm 55mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e8eeea; font-family: Arial, sans-serif; }
    .print-toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 18px;
      padding: 12px 18px; color: #fff; background: #173d30; }
    .print-toolbar span { flex: 1; opacity: .75; }
    .print-toolbar button { border: 0; border-radius: 8px; padding: 9px 18px; font-weight: 700; cursor: pointer; }
    .tag { width: 55mm; height: 55mm; margin: 8mm auto; overflow: hidden; background: #fff;
      box-shadow: 0 5px 22px #173d3025; break-after: page; page-break-after: always; }
    .tag:last-child { break-after: auto; page-break-after: auto; }
    .tag svg { display: block; width: 55mm; height: 55mm; }
    @media print {
      body { background: #fff; } .print-toolbar { display: none; }
      .tag { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${printToolbar(`Бирки ${order.displayNumber}: ${labels.length} шт.`)}
  ${pages || '<p>В заказе нет позиций для печати.</p>'}
</body>
</html>`
}
