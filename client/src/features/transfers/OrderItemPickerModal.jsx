import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { useOrder } from '../../queries/orders.js'
import { listOrders } from '../../services/orders.js'
import { apiError, orderStatusLabel } from '../../pages/workspace-utils.js'
import styles from './OrderItemPickerModal.module.css'

const itemStatusLabels = {
  accepted: 'Принято',
  in_progress: 'В работе',
  ready: 'Готово',
  issued: 'Выдано',
  cancelled: 'Отменено',
}

const isItemTransferable = (order, item) =>
  !['issued', 'cancelled', 'rejected'].includes(item.status) &&
  !['draft', 'cancelled', 'issued'].includes(order.status)

export function OrderItemPickerModal({ addItem, onClose }) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const searchReady = debouncedQuery.trim().length > 1

  const orders = useQuery({
    queryKey: ['transfer-order-lookup', debouncedQuery],
    queryFn: () => listOrders({ search: debouncedQuery.trim(), pageSize: 8 }),
    enabled: searchReady,
  })
  const orderDetail = useOrder(selectedOrderId)

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-item-picker-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Перемещение</p>
            <h2 id="order-item-picker-title">Добавить изделие по номеру заказа</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal-form">
          <label>
            Номер заказа или клиент
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedOrderId('')
              }}
              placeholder="Например, 000014"
            />
          </label>

          {!selectedOrderId ? (
            <div className="choice-list">
              {!searchReady && <p className="muted">Введите минимум 2 символа.</p>}
              {searchReady && orders.isPending && <p className="muted">Ищем…</p>}
              {searchReady && !orders.isPending && !orders.data?.length && (
                <p className="muted">Заказ не найден</p>
              )}
              {(orders.data ?? []).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedOrderId(row.id)}
                >
                  <span>
                    <strong>{row.displayNumber}</strong>
                    <small>{row.client?.fullName}</small>
                  </span>
                  <span className={`status-pill status-${row.status}`}>
                    {orderStatusLabel(row.status)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.itemList}>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedOrderId('')}
              >
                ← К поиску заказов
              </button>
              {orderDetail.isPending ? (
                <p className="muted">Загружаем изделия…</p>
              ) : !orderDetail.data?.items?.length ? (
                <p className="muted">В заказе нет изделий</p>
              ) : (
                orderDetail.data.items.map((item) => {
                  const eligible = isItemTransferable(orderDetail.data, item)
                  const pending =
                    addItem.isPending && addItem.variables === item.scanCode
                  return (
                    <article key={item.id}>
                      <div>
                        <strong>
                          {item.nomenclature?.name ||
                            item.garmentType?.name ||
                            item.description ||
                            'Изделие'}
                        </strong>
                        <span>{itemStatusLabels[item.status] ?? item.status}</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!eligible || addItem.isPending}
                        onClick={() => addItem.mutate(item.scanCode)}
                      >
                        {pending
                          ? 'Добавляем…'
                          : eligible
                            ? 'Добавить'
                            : 'Недоступно'}
                      </button>
                    </article>
                  )
                })
              )}
            </div>
          )}
          {addItem.error && <p className="form-error">{apiError(addItem.error)}</p>}
        </div>
      </section>
    </div>
  )
}
