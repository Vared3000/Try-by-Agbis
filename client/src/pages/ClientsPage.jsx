import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { ClientPickerModal } from './ClientPickerModal.jsx'

export function ClientsPage({ onUseClient }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [createOpen, setCreateOpen] = useState(false)
  const clients = useQuery({
    queryKey: ['clients-page', debouncedSearch],
    queryFn: async () =>
      (
        await apiClient.get('/clients', {
          params: { search: debouncedSearch || undefined, pageSize: 100 },
        })
      ).data.data,
  })

  return (
    <section className="panel">
      <div className="module-toolbar">
        <div>
          <p className="eyebrow">Клиентская база</p>
          <h2>Клиенты</h2>
          <p>Поиск по ФИО, названию или номеру телефона.</p>
        </div>
        <button className="primary-button" onClick={() => setCreateOpen(true)}>
          + Создать клиента
        </button>
      </div>
      <div className="table-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Телефон или ФИО"
        />
        <span>{clients.data?.length ?? 0} клиентов</span>
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
          <div className="empty-state compact">Клиенты не найдены</div>
        )}
      </div>
      {createOpen && (
        <ClientPickerModal
          onClose={() => setCreateOpen(false)}
          onSelect={(client) => {
            queryClient.invalidateQueries({ queryKey: ['clients-page'] })
            queryClient.invalidateQueries({ queryKey: ['clients'] })
            onUseClient?.(client)
          }}
        />
      )}
    </section>
  )
}
