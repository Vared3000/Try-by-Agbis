export const money = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(Number(value || 0) / 100)

export const apiError = (error) =>
  error.response?.data?.error?.message ?? 'Операция не выполнена'

export const isClientFacingLocation = (location) => location.type !== 'production'

export const orderStatusLabel = (status) =>
  ({
    draft: 'Черновик',
    accepted: 'Принят',
    in_progress: 'В работе',
    partially_ready: 'Частично готов',
    ready: 'Готов',
    partially_issued: 'Частично выдан',
    issued: 'Выдан',
    cancelled: 'Отменён',
  })[status] ||
  status?.replaceAll('_', ' ') ||
  'Неизвестно'

export async function openApiDocument(apiClient, url, mimeType) {
  const previewWindow = window.open('about:blank', '_blank')
  if (previewWindow) {
    previewWindow.opener = null
    previewWindow.document.title = 'Подготовка печати…'
    previewWindow.document.body.textContent = 'Подготавливаем документ…'
  }
  try {
    const response = await apiClient.get(url, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: mimeType })
    const objectUrl = URL.createObjectURL(blob)
    if (previewWindow) previewWindow.location.replace(objectUrl)
    else window.open(objectUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    previewWindow?.close()
    throw error
  }
}
