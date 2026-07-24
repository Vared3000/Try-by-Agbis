export function orderDisplayNumber({ branchNumber, sequence }) {
  return `${String(sequence).padStart(6, '0')}-${branchNumber}`
}
