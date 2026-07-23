import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { apiError } from './workspace-utils.js'

export function ClientsPage({ onUseClient }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' })
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await apiClient.get('/clients?pageSize=100')).data.data,
  })
  const createClient = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post('/clients', {
          ...form,
          phone: form.phone || null,
          email: form.email || null,
        })
      ).data.data,
    onSuccess: (client) => {
      setForm({ fullName: '', phone: '', email: '' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onUseClient?.(client)
    },
  })

  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Новый клиент</p>
            <h2>Карточка клиента</h2>
          </div>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            createClient.mutate()
          }}
        >
          <label className="field-wide">
            ФИО или название
            <input
              required
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
          {createClient.error && (
            <p className="form-error field-wide">{apiError(createClient.error)}</p>
          )}
          <button className="primary-button field-wide" disabled={createClient.isPending}>
            {createClient.isPending ? 'Сохраняем…' : 'Создать клиента'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Клиентская база</h2>
          <span>{clients.data?.length ?? 0} записей</span>
        </div>
        <div className="data-list">
          {(clients.data ?? []).map((client) => (
            <article key={client.id}>
              <div>
                <strong>{client.fullName}</strong>
                <span>{client.phone || client.email || 'Контакты не указаны'}</span>
              </div>
              {onUseClient && (
                <button className="text-button" onClick={() => onUseClient(client)}>
                  В заказ
                </button>
              )}
            </article>
          ))}
          {!clients.isPending && !clients.data?.length && (
            <div className="empty-state compact">Клиентов пока нет</div>
          )}
        </div>
      </section>
    </div>
  )
}
