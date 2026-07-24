export function availableServicePrices(item, prices) {
  const selected = new Map()
  for (const price of prices) {
    if (!price.serviceId || !price.service) continue
    const exactGarmentPrice =
      item.garmentTypeId && price.garmentTypeId === item.garmentTypeId
    const genericPrice = !price.garmentTypeId
    if (!exactGarmentPrice && !genericPrice) continue
    if (item.nomenclatureItemId && !genericPrice) continue
    const current = selected.get(price.serviceId)
    if (!current || exactGarmentPrice) selected.set(price.serviceId, price)
  }
  const addedServiceIds = new Set((item.services ?? []).map((row) => row.serviceId))
  return [...selected.values()]
    .filter((price) => !addedServiceIds.has(price.serviceId))
    .sort((left, right) => left.service.name.localeCompare(right.service.name, 'ru-RU'))
}
