import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { apiClient } from '../api/client.js'
import { apiError } from './workspace-utils.js'

export function ProductionPage() {
  const [scanCode, setScanCode] = useState('')
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const routes = useQuery({
    queryKey: ['production-routes'],
    queryFn: async () => (await apiClient.get('/production/routes')).data.data,
  })

  const scan = async (code = scanCode) => {
    setError('')
    try {
      const response = await apiClient.get(
        `/production/items/scan/${encodeURIComponent(code)}`,
      )
      setItem(response.data.data)
    } catch (requestError) {
      setItem(null)
      setError(apiError(requestError))
    }
  }
  const transition = useMutation({
    mutationFn: ({ stageId, action }) =>
      apiClient.post(`/order-items/${item.id}/transition`, {
        stageId,
        action,
      }),
    onSuccess: () => scan(item.scanCode),
  })
  const route = routes.data?.find((row) => row.id === item?.routeId)
  const histories = useMemo(
    () =>
      [...(item?.stageHistory ?? [])].sort(
        (left, right) => new Date(left.createdAt) - new Date(right.createdAt),
      ),
    [item],
  )
  const latest = histories.at(-1)
  const activeStage = route?.stages?.find((row) => row.stageId === latest?.stageId)
  const lastCompletedIndex = latest
    ? route?.stages?.findIndex((row) => row.stageId === latest.stageId)
    : -1
  const nextStage =
    latest?.status === 'rework'
      ? route?.stages?.[0]
      : route?.stages?.[latest?.status === 'completed' ? lastCompletedIndex + 1 : 0]

  return (
    <div className="stack">
      <section className="panel scanner-panel">
        <p className="eyebrow">Производство</p>
        <h2>Сканирование бирки</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            scan()
          }}
          className="scan-form"
        >
          <input
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            placeholder="QR или Code 128"
            autoFocus
          />
          <button className="primary-button">Найти изделие</button>
        </form>
        {error && <p className="form-error">{error}</p>}
      </section>

      {item && (
        <section className="panel production-card">
          <div className="order-summary">
            <div>
              <span className="status-pill">{item.status}</span>
              <h2>{item.description || item.nomenclature?.name || 'Изделие'}</h2>
              <p>Заказ {item.order?.displayNumber}</p>
            </div>
            <code>{item.scanCode}</code>
          </div>
          {!route ? (
            <p className="form-error">Для изделия не назначен производственный маршрут</p>
          ) : (
            <>
              <div className="production-route">
                {route.stages.map((routeStage, index) => {
                  const history = [...histories]
                    .reverse()
                    .find((row) => row.stageId === routeStage.stageId)
                  const current = latest?.stageId === routeStage.stageId
                  return (
                    <div
                      key={routeStage.id}
                      className={`${history?.status || ''} ${current ? 'current' : ''}`}
                    >
                      <span>{index + 1}</span>
                      <strong>{routeStage.stage?.name}</strong>
                      <small>
                        {{
                          in_progress: 'В работе',
                          completed: 'Завершён',
                          rework: 'На доработке',
                        }[history?.status] || 'Ожидает'}
                      </small>
                    </div>
                  )
                })}
              </div>
              <div className="production-actions">
                {latest?.status === 'in_progress' ? (
                  <>
                    <button
                      className="primary-button"
                      disabled={transition.isPending}
                      onClick={() =>
                        transition.mutate({
                          stageId: latest.stageId,
                          action: 'complete',
                        })
                      }
                    >
                      Завершить этап «{activeStage?.stage?.name}»
                    </button>
                    {activeStage?.stage?.code === 'QUALITY_CONTROL' && (
                      <button
                        className="secondary-button danger-button"
                        disabled={transition.isPending}
                        onClick={() =>
                          transition.mutate({
                            stageId: latest.stageId,
                            action: 'rework',
                          })
                        }
                      >
                        Вернуть на доработку
                      </button>
                    )}
                  </>
                ) : nextStage ? (
                  <button
                    className="primary-button"
                    disabled={transition.isPending}
                    onClick={() =>
                      transition.mutate({
                        stageId: nextStage.stageId,
                        action: 'start',
                      })
                    }
                  >
                    Начать этап «{nextStage.stage?.name}»
                  </button>
                ) : (
                  <span className="online-badge">Изделие готово к выдаче</span>
                )}
              </div>
              {transition.error && (
                <p className="form-error">{apiError(transition.error)}</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
