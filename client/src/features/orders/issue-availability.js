export function remainingOrderItems(items = []) {
  return items.filter((item) => item.status !== 'issued')
}

export function canIssueWholeOrder(items = []) {
  const remainingItems = remainingOrderItems(items)
  return (
    remainingItems.length > 0 && remainingItems.every((item) => item.status === 'ready')
  )
}
