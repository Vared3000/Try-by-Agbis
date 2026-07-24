import { useState } from 'react'

import { ClientPickerModal } from '../../pages/ClientPickerModal.jsx'
import { apiError } from '../../pages/workspace-utils.js'

export function OrderMetaEditor({ order, updateOrder, onClose }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [form, setForm] = useState({
    clientId: order.clientId,
    client: order.client,
    dueAt: order.dueAt ? new Date(order.dueAt).toLocaleString('sv-SE').slice(0, 16) : '',
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
                  dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
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
            <label>
              Срок готовности
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) =>
                  setForm((value) => ({ ...value, dueAt: event.target.value }))
                }
              />
            </label>
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
