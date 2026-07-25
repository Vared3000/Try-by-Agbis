import { useMemo, useRef, useState } from 'react'

import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useProductionItems, useProductionRoutes } from '../queries/production.js'
import { useTransitionProductionItem } from '../mutations/production.js'
import { scanProductionItem } from '../services/production.js'
import { apiError } from './workspace-utils.js'

export function ProductionPage() {
  const scannerRef = useRef(null)
  const [scanCode, setScanCode] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [status, setStatus] = useState('')
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const routes = useProductionRoutes()
  const queue = useProductionItems(debouncedSearch, status)

  const scan = async (code = scanCode) => {
    if (!code.trim()) return
    setError('')
    try {
      const scannedItem = await scanProductionItem(code.trim())
      setItem(scannedItem)
      window.requestAnimationFrame(() => scannerRef.current?.select())
    } catch (requestError) {
      setItem(null)
      setError(apiError(requestError))
      window.requestAnimationFrame(() => scannerRef.current?.select())
    }
  }
  const transition = useTransitionProductionItem()
  const runTransition = (stageId, action) =>
    transition.mutate(
      { itemId: item.id, stageId, action },
      { onSuccess: () => scan(item.scanCode) },
    )
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
            ref={scannerRef}
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            placeholder="QR или Code 128"
            autoFocus
          />
          <button className="primary-button">Найти изделие</button>
        </form>
        {error && <p className="form-error">{error}</p>}
      </section>

      <div className="production-workspace">
        <section className="panel production-queue">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Очередь</p>
              <h2>Изделия в производстве</h2>
            </div>
            <span>{queue.data?.meta?.total ?? 0} позиций</span>
          </div>
          <div className="production-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Заказ, клиент, телефон, изделие или код"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Все рабочие статусы</option>
              <option value="accepted">Ожидают запуска</option>
              <option value="in_progress">В работе</option>
              <option value="cleaning">Чистка</option>
              <option value="quality_control">Контроль качества</option>
              <option value="packing">Упаковка</option>
              <option value="rework">Доработка</option>
              <option value="ready">Готовы к выдаче</option>
            </select>
          </div>
          {queue.isPending ? (
            <div className="empty-state compact">Загружаем очередь…</div>
          ) : queue.error ? (
            <p className="form-error">{apiError(queue.error)}</p>
          ) : !queue.data?.data?.length ? (
            <div className="empty-state compact">В выбранном разделе изделий нет</div>
          ) : (
            <div className="production-queue-list">
              {queue.data.data.map((row) => (
                <button
                  key={row.id}
                  className={item?.id === row.id ? 'active' : ''}
                  onClick={() => {
                    setScanCode(row.scanCode)
                    scan(row.scanCode)
                  }}
                >
                  <div>
                    <strong>
                      {row.description ||
                        row.nomenclature?.name ||
                        row.garmentType?.name ||
                        'Изделие'}
                    </strong>
                    <span>
                      {row.order?.displayNumber} · {row.order?.client?.fullName}
                    </span>
                    <small>{row.scanCode}</small>
                  </div>
                  <div className="queue-status">
                    <span className={`status-pill status-${row.status}`}>
                      {statusLabel(row.status)}
                    </span>
                    {row.order?.dueAt && (
                      <small className={isOverdue(row.order.dueAt) ? 'overdue' : ''}>
                        Срок {new Date(row.order.dueAt).toLocaleDateString('ru-RU')}
                      </small>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {item ? (
          <section className="panel production-card">
            <div className="order-summary">
              <div>
                <span className="status-pill">{statusLabel(item.status)}</span>
                <h2>{item.description || item.nomenclature?.name || 'Изделие'}</h2>
                <p>Заказ {item.order?.displayNumber}</p>
              </div>
              <details className="technical-details">
                <summary>Код бирки</summary>
                <code>{item.scanCode}</code>
              </details>
            </div>
            {!route ? (
              <p className="form-error">
                Для изделия не назначен производственный маршрут
              </p>
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
                        onClick={() => runTransition(latest.stageId, 'complete')}
                      >
                        Завершить этап «{activeStage?.stage?.name}»
                      </button>
                      {activeStage?.stage?.code === 'QUALITY_CONTROL' && (
                        <button
                          className="secondary-button danger-button"
                          disabled={transition.isPending}
                          onClick={() => runTransition(latest.stageId, 'rework')}
                        >
                          Вернуть на доработку
                        </button>
                      )}
                    </>
                  ) : nextStage ? (
                    <button
                      className="primary-button"
                      disabled={transition.isPending}
                      onClick={() => runTransition(nextStage.stageId, 'start')}
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
        ) : (
          <section className="panel production-placeholder">
            <span>⌁</span>
            <h2>Выберите или отсканируйте изделие</h2>
            <p>
              Карточка операции появится здесь. После действия фокус вернётся в сканер.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function statusLabel(status) {
  return (
    {
      accepted: 'Ожидает запуска',
      in_progress: 'В работе',
      cleaning: 'Чистка',
      quality_control: 'Контроль качества',
      packing: 'Упаковка',
      rework: 'Доработка',
      ready: 'Готово',
    }[status] || status.replaceAll('_', ' ')
  )
}

function isOverdue(value) {
  return new Date(value).getTime() < Date.now()
}
