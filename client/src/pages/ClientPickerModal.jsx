import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { apiError } from './workspace-utils.js'

export function ClientPickerModal({ onClose, onSelect }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '' })
  const deferredSearch = useDebouncedValue(search.trim())
  const normalizedSearch = search.trim()
  const clients = useQuery({
    queryKey: ['client-picker', deferredSearch],
    queryFn: async () =>
      (
        await apiClient.get('/clients', {
          params: { search: deferredSearch || undefined, pageSize: 50 },
        })
      ).data.data,
    enabled: deferredSearch.length >= 2,
  })
  const searchReady =
    normalizedSearch.length >= 2 &&
    normalizedSearch === deferredSearch &&
    clients.isSuccess &&
    !clients.isFetching
  const createClient = useMutation({
    mutationFn: async () => {
      const client = (
        await apiClient.post('/clients', {
          fullName: form.fullName,
          phone: form.phone || null,
          email: form.email || null,
        })
      ).data.data
      await apiClient.post(`/clients/${client.id}/addresses`, {
        address: form.address,
        isPrimary: true,
      })
      return client
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onSelect(client)
      onClose()
    },
  })

  const startCreating = () => {
    const looksLikePhone = /^[+\d()\s-]{5,}$/.test(search.trim())
    setForm({
      fullName: looksLikePhone ? '' : search.trim(),
      phone: looksLikePhone ? search.trim() : '',
      email: '',
      address: '',
    })
    setCreating(true)
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal-card client-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-picker-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Заказ</p>
            <h2 id="client-picker-title">Выбор клиента</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {!creating ? (
          <>
            <label className="client-search">
              Поиск по номеру телефона или ФИО
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Начните вводить телефон или имя"
              />
            </label>
            <div className="picker-results">
              {normalizedSearch.length < 2 && (
                <div className="empty-state compact">
                  Введите минимум 2 символа имени или телефона.
                </div>
              )}
              {(clients.data ?? []).map((client) => (
                <button
                  key={client.id}
                  className="picker-client"
                  onClick={() => {
                    onSelect(client)
                    onClose()
                  }}
                >
                  <span className="avatar">
                    {client.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{client.fullName}</strong>
                    <small>
                      {[client.phone, client.email].filter(Boolean).join(' · ') ||
                        'Контакты не указаны'}
                    </small>
                  </span>
                  <b>Выбрать</b>
                </button>
              ))}
              {normalizedSearch.length >= 2 && !searchReady && !clients.isError && (
                <div className="empty-state compact">Ищем клиентов…</div>
              )}
              {clients.isError && (
                <div className="empty-state compact">
                  <span>Не удалось проверить клиентскую базу.</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => clients.refetch()}
                  >
                    Повторить поиск
                  </button>
                </div>
              )}
              {searchReady && !clients.data?.length && (
                <div className="empty-state compact">
                  Клиент не найден. Создайте новую карточку.
                </div>
              )}
            </div>
            <button
              className="primary-button"
              disabled={!searchReady}
              onClick={startCreating}
            >
              {normalizedSearch.length < 2
                ? 'Сначала найдите клиента'
                : clients.isError
                  ? 'Поиск временно недоступен'
                  : !searchReady
                    ? 'Проверяем совпадения…'
                    : `+ Создать «${normalizedSearch}»`}
            </button>
          </>
        ) : (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              createClient.mutate()
            }}
          >
            <button
              type="button"
              className="text-button back-button"
              onClick={() => setCreating(false)}
            >
              ← Назад к поиску
            </button>
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
              <small>Нужен для доставки и будет показан в квитанции.</small>
            </label>
            {createClient.error && (
              <p className="form-error">{apiError(createClient.error)}</p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreating(false)}
              >
                Отмена
              </button>
              <button className="primary-button" disabled={createClient.isPending}>
                {createClient.isPending ? 'Создаём…' : 'Создать и выбрать'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
