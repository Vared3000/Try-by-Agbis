import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'

import { apiClient } from '../api/client.js'
import { OrderItemPickerModal } from '../features/transfers/OrderItemPickerModal.jsx'
import { useTransfer, useTransfers } from '../queries/transfers.js'
import {
  useAddTransferItem,
  useCreateTransfer,
  useReceiveTransfer,
  useRemoveTransferItem,
  useSendTransfer,
} from '../mutations/transfers.js'
import { apiError } from './workspace-utils.js'

const statusLabels = {
  draft: 'Черновик',
  in_transit: 'В пути',
  received: 'Принята',
  cancelled: 'Отменена',
}

const itemStatusLabels = {
  planned: 'Ожидает отправки',
  received: 'Принято',
  missing: 'Не найдено при приёмке',
}

export function TransfersPage() {
  const scannerRef = useRef(null)
  const [selectedId, setSelectedId] = useState('')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [scanCode, setScanCode] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [receivedIds, setReceivedIds] = useState([])
  const [receivedForKey, setReceivedForKey] = useState('')

  const context = useQuery({
    queryKey: ['auth-context'],
    queryFn: async () => (await apiClient.get('/auth/context')).data.data,
  })
  const transfers = useTransfers()
  const effectiveSelectedId = selectedId || transfers.data?.[0]?.id || ''
  const detail = useTransfer(effectiveSelectedId)
  const locations = useMemo(
    () =>
      (context.data?.branches ?? []).flatMap((branch) =>
        branch.locations.map((location) => ({
          ...location,
          branchName: branch.name,
        })),
      ),
    [context.data],
  )
  const effectiveFromLocationId = fromLocationId || locations[0]?.id || ''
  const effectiveToLocationId =
    toLocationId ||
    locations.find((location) => location.id !== effectiveFromLocationId)?.id ||
    ''

  const receivedKey =
    detail.data?.status === 'in_transit' ? `${detail.data.id}:${detail.data.status}` : ''
  if (receivedKey && receivedKey !== receivedForKey) {
    setReceivedForKey(receivedKey)
    setReceivedIds(detail.data.items.map((item) => item.id))
  }

  const createTransfer = useCreateTransfer()
  const addItem = useAddTransferItem(effectiveSelectedId, {
    onSuccess: () => {
      setScanCode('')
      window.requestAnimationFrame(() => scannerRef.current?.focus())
    },
  })
  const removeItem = useRemoveTransferItem(effectiveSelectedId)
  const sendTransfer = useSendTransfer(effectiveSelectedId)
  const receiveTransfer = useReceiveTransfer(effectiveSelectedId)
  const error =
    createTransfer.error ||
    addItem.error ||
    removeItem.error ||
    sendTransfer.error ||
    receiveTransfer.error
  const document = detail.data

  return (
    <div className="transfer-workspace">
      <section className="panel transfer-sidebar">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Новая накладная</p>
            <h2>Перемещение</h2>
          </div>
        </div>
        <form
          className="transfer-create-form"
          onSubmit={(event) => {
            event.preventDefault()
            createTransfer.mutate(
              {
                fromLocationId: effectiveFromLocationId,
                toLocationId: effectiveToLocationId,
                notes: notes.trim() || null,
              },
              {
                onSuccess: (created) => {
                  setSelectedId(created.id)
                  setNotes('')
                  window.requestAnimationFrame(() => scannerRef.current?.focus())
                },
              },
            )
          }}
        >
          <label>
            Откуда
            <select
              value={effectiveFromLocationId}
              onChange={(event) => setFromLocationId(event.target.value)}
              required
            >
              <option value="">Выберите пункт</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.branchName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Куда
            <select
              value={effectiveToLocationId}
              onChange={(event) => setToLocationId(event.target.value)}
              required
            >
              <option value="">Выберите пункт</option>
              {locations
                .filter((location) => location.id !== effectiveFromLocationId)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} · {location.branchName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Комментарий
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Например: плановая отправка в цех"
              rows={2}
            />
          </label>
          <button
            className="primary-button"
            disabled={
              createTransfer.isPending ||
              !effectiveFromLocationId ||
              !effectiveToLocationId ||
              effectiveFromLocationId === effectiveToLocationId
            }
          >
            Создать накладную
          </button>
        </form>

        <div className="transfer-list">
          <div className="panel-title compact-title">
            <strong>Последние накладные</strong>
            <span>{transfers.data?.length ?? 0}</span>
          </div>
          {transfers.isPending ? (
            <p className="muted">Загружаем…</p>
          ) : !transfers.data?.length ? (
            <p className="muted">Накладных пока нет</p>
          ) : (
            transfers.data.map((row) => (
              <button
                key={row.id}
                className={effectiveSelectedId === row.id ? 'active' : ''}
                onClick={() => setSelectedId(row.id)}
              >
                <div>
                  <strong>{row.displayNumber}</strong>
                  <span>
                    {row.fromLocation.name} → {row.toLocation.name}
                  </span>
                </div>
                <div>
                  <span className={`status-pill status-${row.status}`}>
                    {statusLabels[row.status] ?? row.status}
                  </span>
                  <small>{row.items.length} изд.</small>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="panel transfer-detail">
        {!effectiveSelectedId ? (
          <div className="empty-state">
            <span>⇄</span>
            <h2>Выберите или создайте накладную</h2>
            <p>Изделия добавляются сканированием кода с бирки.</p>
          </div>
        ) : detail.isPending ? (
          <div className="empty-state">Загружаем накладную…</div>
        ) : detail.error ? (
          <p className="form-error">{apiError(detail.error)}</p>
        ) : (
          <>
            <div className="transfer-head">
              <div>
                <p className="eyebrow">Накладная перемещения</p>
                <h2>{document.displayNumber}</h2>
                <p>
                  {document.fromLocation.name} <b>→</b> {document.toLocation.name}
                </p>
              </div>
              <span className={`status-pill status-${document.status}`}>
                {statusLabels[document.status] ?? document.status}
              </span>
            </div>

            {document.status === 'draft' && (
              <form
                className="scan-form transfer-scan"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (scanCode.trim()) addItem.mutate(scanCode.trim())
                }}
              >
                <input
                  ref={scannerRef}
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  placeholder="Отсканируйте QR / Code 128 или введите код бирки"
                  autoFocus
                />
                <button
                  className="primary-button"
                  disabled={addItem.isPending || !scanCode.trim()}
                >
                  Добавить изделие
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPickerOpen(true)}
                >
                  По номеру заказа…
                </button>
              </form>
            )}

            <div className="transfer-items">
              <div className="panel-title compact-title">
                <strong>Изделия</strong>
                <span>{document.items.length}</span>
              </div>
              {!document.items.length ? (
                <div className="empty-state compact">
                  Отсканируйте первую бирку — изделие появится здесь
                </div>
              ) : (
                document.items.map((row) => {
                  const item = row.orderItem
                  const checked = receivedIds.includes(row.id)
                  return (
                    <article key={row.id}>
                      {document.status === 'in_transit' && (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setReceivedIds((current) =>
                              checked
                                ? current.filter((id) => id !== row.id)
                                : [...current, row.id],
                            )
                          }
                          aria-label={`Принять ${item.scanCode}`}
                        />
                      )}
                      <div>
                        <strong>
                          {item.nomenclature?.name ||
                            item.garmentType?.name ||
                            item.description ||
                            'Изделие'}
                        </strong>
                        <span>
                          {item.order.displayNumber} · {item.order.client.fullName}
                        </span>
                        <small>{item.scanCode}</small>
                      </div>
                      <span className={`status-pill status-${row.status}`}>
                        {itemStatusLabels[row.status] ?? row.status}
                      </span>
                      {document.status === 'draft' && (
                        <button
                          className="link-button danger-link"
                          disabled={removeItem.isPending}
                          onClick={() => removeItem.mutate(row.id)}
                        >
                          Убрать
                        </button>
                      )}
                    </article>
                  )
                })
              )}
            </div>

            {error && <p className="form-error">{apiError(error)}</p>}
            <div className="transfer-actions">
              {document.status === 'draft' && (
                <button
                  className="primary-button"
                  disabled={sendTransfer.isPending || !document.items.length}
                  onClick={() => sendTransfer.mutate()}
                >
                  Отправить {document.items.length} изделий
                </button>
              )}
              {document.status === 'in_transit' && (
                <>
                  <p>
                    Отмечено {receivedIds.length} из {document.items.length}. Снятые
                    позиции будут отмечены как расхождение.
                  </p>
                  <button
                    className="primary-button"
                    disabled={receiveTransfer.isPending}
                    onClick={() => receiveTransfer.mutate(receivedIds)}
                  >
                    Подтвердить приёмку
                  </button>
                </>
              )}
              {document.status === 'received' && (
                <p className="success-note">
                  Перемещение завершено. Принято{' '}
                  {document.items.filter((item) => item.status === 'received').length},
                  расхождений{' '}
                  {document.items.filter((item) => item.status === 'missing').length}.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {pickerOpen && (
        <OrderItemPickerModal addItem={addItem} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
