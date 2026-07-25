import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../../api/client.js'
import { apiError } from '../../pages/workspace-utils.js'

export function ClientEditModal({ client, onClose }) {
  const queryClient = useQueryClient()
  const primaryAddress =
    client.addresses?.find((address) => address.isPrimary) ?? client.addresses?.[0]
  const [form, setForm] = useState({
    fullName: client.fullName,
    phone: client.phone || '',
    email: client.email || '',
    notes: client.notes || '',
    address: primaryAddress?.address || '',
  })

  const save = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/clients/${client.id}`, {
        fullName: form.fullName,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      })
      const trimmedAddress = form.address.trim()
      if (trimmedAddress !== (primaryAddress?.address ?? '')) {
        await apiClient.post(`/clients/${client.id}/addresses`, {
          address: trimmedAddress,
          isPrimary: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      queryClient.invalidateQueries({ queryKey: ['clients-page'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
  })

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
            save.mutate()
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
