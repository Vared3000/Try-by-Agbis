const urgencyFactors = {
  normal: 1,
  urgent: 0.65,
  express: 0.4,
}

const isWorkingDay = (date) => date.getDay() !== 0

const moveToWorkingTime = (value) => {
  const date = new Date(value)
  date.setSeconds(0, 0)
  while (true) {
    if (!isWorkingDay(date)) {
      date.setDate(date.getDate() + 1)
      date.setHours(9, 0, 0, 0)
      continue
    }
    if (date.getHours() < 9) {
      date.setHours(9, 0, 0, 0)
      return date
    }
    if (date.getHours() > 18 || (date.getHours() === 18 && date.getMinutes() > 0)) {
      date.setDate(date.getDate() + 1)
      date.setHours(9, 0, 0, 0)
      continue
    }
    return date
  }
}

export function effectiveLeadTimeHours(leadTimeHours, urgency = 'normal') {
  const normalized = Math.max(1, Number(leadTimeHours) || 48)
  return Math.max(4, Math.ceil(normalized * (urgencyFactors[urgency] ?? 1)))
}

export function suggestDueAt({
  from = new Date(),
  leadTimeHours = 48,
  urgency = 'normal',
}) {
  let remainingMinutes = effectiveLeadTimeHours(leadTimeHours, urgency) * 60
  let cursor = moveToWorkingTime(from)
  while (remainingMinutes > 0) {
    const close = new Date(cursor)
    close.setHours(18, 0, 0, 0)
    const availableMinutes = Math.max(
      0,
      Math.floor((close.getTime() - cursor.getTime()) / 60_000),
    )
    const consumed = Math.min(remainingMinutes, availableMinutes)
    cursor = new Date(cursor.getTime() + consumed * 60_000)
    remainingMinutes -= consumed
    if (remainingMinutes > 0) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(9, 0, 0, 0)
      cursor = moveToWorkingTime(cursor)
    }
  }
  return cursor
}
