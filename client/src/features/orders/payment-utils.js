export function kopecksToRubles(value) {
  const kopecks = BigInt(value || 0)
  const rubles = kopecks / 100n
  const fraction = String(kopecks % 100n).padStart(2, '0')
  return `${rubles}.${fraction}`
}

export function rublesToKopecks(value) {
  const normalized = String(value).trim().replace(',', '.')
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) throw new Error('Введите корректную сумму')
  const fraction = (match[2] || '').padEnd(2, '0')
  const kopecks = BigInt(match[1]) * 100n + BigInt(fraction || 0)
  if (kopecks <= 0n) throw new Error('Сумма должна быть больше нуля')
  return kopecks.toString()
}

export function findReceptionWorkplace(branches, order) {
  const branch = branches.find((row) => row.id === order.branchId)
  if (!branch) return null
  const locations = [...(branch.locations ?? [])].sort((left, right) => {
    if (left.id === order.acceptanceLocationId) return -1
    if (right.id === order.acceptanceLocationId) return 1
    if (left.type === 'acceptance') return -1
    if (right.type === 'acceptance') return 1
    return 0
  })
  const workplaces = locations.flatMap((location) => location.workplaces ?? [])
  return workplaces.find((workplace) => workplace.type === 'reception') ?? workplaces[0]
}
