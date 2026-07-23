export const money = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(Number(value || 0) / 100)

export const apiError = (error) =>
  error.response?.data?.error?.message ?? 'Операция не выполнена'

export async function openApiDocument(apiClient, url, mimeType) {
  const response = await apiClient.get(url, { responseType: 'blob' })
  const blob = new Blob([response.data], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
