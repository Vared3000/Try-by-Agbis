import { useState } from 'react'

import { ClientPickerModal } from '../../pages/ClientPickerModal.jsx'
import { apiError, isClientFacingLocation } from '../../pages/workspace-utils.js'

export function OrderMetaEditor({ branches, order, priceLists, updateOrder, onClose }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const issueLocations = branches.flatMap((branch) =>
    (branch.locations ?? [])
      .filter(isClientFacingLocation)
      .map((location) => ({
        ...location,
        branchName: branch.name,
      })),
  )
  const [form, setForm] = useState({
    clientId: order.clientId,
    client: order.client,
    issueLocationId:
      order.issueLocationId || order.acceptanceLocationId || issueLocations[0]?.id || '',
    priceListId: order.priceListId || priceLists[0]?.id || '',
    dueAt: order.dueAt ? new Date(order.dueAt).toLocaleString('sv-SE').slice(0, 16) : '',
    urgency: order.urgency || 'normal',
    notificationPhone: order.notificationPhone || order.client?.phone || '',
    isRework: Boolean(order.isRework),
    notes: order.notes || '',
  })

  return (
    <>
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
          aria-labelledby="order-meta-title"
        >
          <div className="modal-head">
            <div>
              <p className="eyebrow">Черновик {order.displayNumber}</p>
              <h2 id="order-meta-title">Реквизиты заказа</h2>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              updateOrder.mutate(
                {
                  clientId: form.clientId,
                  issueLocationId: form.issueLocationId,
                  priceListId: form.priceListId || null,
                  dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
                  urgency: form.urgency,
                  notificationPhone: form.notificationPhone || null,
                  isRework: form.isRework,
                  notes: form.notes || null,
                },
                { onSuccess: onClose },
              )
            }}
          >
            <div className="client-selection">
              <div>
                <span className="avatar">
                  {form.client?.fullName?.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <small>Клиент заказа</small>
                  <strong>{form.client?.fullName}</strong>
                  <em>{form.client?.phone || 'Телефон не указан'}</em>
                </span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPickerOpen(true)}
              >
                Сменить клиента
              </button>
            </div>
            <div className="form-grid">
              <label>
                Точка выдачи
                <select
                  required
                  value={form.issueLocationId}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      issueLocationId: event.target.value,
                    }))
                  }
                >
                  {issueLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.branchName} · {location.name}
                    </option>
                  ))}
                </select>
              </label>
              {priceLists.length > 0 && (
                <label>
                  Прайс-лист
                  <select
                    value={form.priceListId}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, priceListId: event.target.value }))
                    }
                  >
                    {priceLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                  <small>Действует для изделий, добавленных после сохранения.</small>
                </label>
              )}
              <label>
                Срок готовности
                <input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, dueAt: event.target.value }))
                  }
                />
                <small>
                  {order.dueDateMode === 'manual'
                    ? 'Дата была установлена вручную.'
                    : 'Дата рассчитана автоматически по нормативу изделия.'}
                </small>
              </label>
              <label>
                Срочность
                <select
                  value={form.urgency}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      urgency: event.target.value,
                    }))
                  }
                >
                  <option value="normal">Обычный заказ</option>
                  <option value="urgent">Срочный</option>
                  <option value="express">Экспресс</option>
                </select>
              </label>
              <label>
                Телефон для уведомлений
                <input
                  type="tel"
                  maxLength="32"
                  value={form.notificationPhone}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      notificationPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="order-rework-check">
              <input
                type="checkbox"
                checked={form.isRework}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    isRework: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Повторная обработка</strong>
                <small>Возврат или доработка ранее принятого изделия</small>
              </span>
            </label>
            {order.dueDateMode === 'manual' && (
              <button
                type="button"
                className="text-button"
                onClick={() => setForm((value) => ({ ...value, dueAt: '' }))}
              >
                Вернуть автоматический расчёт срока
              </button>
            )}
            <label>
              Комментарий
              <textarea
                rows="4"
                maxLength="5000"
                value={form.notes}
                onChange={(event) =>
                  setForm((value) => ({ ...value, notes: event.target.value }))
                }
              />
            </label>
            {updateOrder.error && (
              <p className="form-error">{apiError(updateOrder.error)}</p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Отмена
              </button>
              <button className="primary-button" disabled={updateOrder.isPending}>
                Сохранить изменения
              </button>
            </div>
          </form>
        </section>
      </div>
      {pickerOpen && (
        <ClientPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(client) =>
            setForm((value) => ({
              ...value,
              clientId: client.id,
              client,
            }))
          }
        />
      )}
    </>
  )
}
