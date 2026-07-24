export const checkDigit = (value) =>
  String([...String(value)].reduce((sum, digit) => sum + Number(digit), 0) % 10)

export function orderDisplayNumber({ locationCode, businessDate, sequence }) {
  const compactDate = String(businessDate).replaceAll('-', '')
  return `${locationCode}-${compactDate}-${sequence}-${checkDigit(sequence)}`
}
