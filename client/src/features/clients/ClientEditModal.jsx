import { useState } from 'react'

import { apiError } from '../../pages/workspace-utils.js'
import { useUpdateClientWithAddress } from '../../mutations/clients.js'

export function ClientEditModal({ client, onClose }) {
  const primaryAddress =
    client.addresses?.find((address) => address.isPrimary) ?? client.addresses?.[0]
  const [form, setForm] = useState({
    fullName: client.fullName,
    phone: client.phone || '',
    email: client.email || '',
    notes: client.notes || '',
    address: primaryAddress?.address || '',
  })

  const save = useUpdateClientWithAddress(client.id)

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
        aria-labelledby="client-edit-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Карточка клиента</p>
            <h2 id="client-edit-title">Редактирование клиента</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { ...form, previousAddress: primaryAddress?.address ?? '' },
              { onSuccess: onClose },
            )
          }}
        >
          <label>
            ФИО или название
            <input
              autoFocus
              required
              minLength="2"
              value={form.fullName}
              onChange={(event) =>
                setForm((value) => ({ ...value, fullName: event.target.value }))
              }
            />
          </label>
          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((value) => ({ ...value, phone: event.target.value }))
              }
              placeholder="+7 900 000-00-00"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((value) => ({ ...value, email: event.target.value }))
              }
            />
          </label>
          <label>
            Адрес доставки
            <input
              required
              minLength="5"
              value={form.address}
              onChange={(event) =>
                setForm((value) => ({ ...value, address: event.target.value }))
              }
              placeholder="Город, улица, дом, квартира"
            />
            <small>Нужен для доставки и показывается в квитанции.</small>
          </label>
          <label>
            Комментарий
            <textarea
              rows="3"
              value={form.notes}
              onChange={(event) =>
                setForm((value) => ({ ...value, notes: event.target.value }))
              }
            />
          </label>
          {save.error && <p className="form-error">{apiError(save.error)}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-button" disabled={save.isPending}>
              {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
