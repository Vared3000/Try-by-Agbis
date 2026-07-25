import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ClientProfilePanel } from '../features/clients/ClientProfilePanel.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useClient, useClientOrders, useClients } from '../queries/clients.js'
import { ClientPickerModal } from './ClientPickerModal.jsx'
import { apiError } from './workspace-utils.js'

export function ClientsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const selectedClientId = location.pathname.match(/^\/clients\/([^/]+)$/)?.[1] || ''
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [createOpen, setCreateOpen] = useState(false)
  const clients = useClients(debouncedSearch)
  const client = useClient(selectedClientId)
  const clientOrders = useClientOrders(selectedClientId)

  return (
    <div className="stack">
      <section className="panel">
        <div className="module-toolbar">
          <div>
            <p className="eyebrow">Клиентская база</p>
            <h2>Клиенты</h2>
            <p>Выберите клиента, чтобы увидеть контакты и всю историю заказов.</p>
          </div>
          <button className="primary-button" onClick={() => setCreateOpen(true)}>
            + Создать клиента
          </button>
        </div>
      </section>

      <div className="client-workspace">
        <section className="panel client-directory">
          <div className="table-toolbar">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Телефон или ФИО"
              aria-label="Поиск клиентов"
            />
            <span>{clients.data?.length ?? 0} клиентов</span>
          </div>
          <div className="client-list">
            {(clients.data ?? []).map((clientRow) => (
              <button
                key={clientRow.id}
                className={`client-list-row ${
                  selectedClientId === clientRow.id ? 'active' : ''
                }`}
                onClick={() => navigate(`/clients/${clientRow.id}`)}
                aria-current={selectedClientId === clientRow.id ? 'true' : undefined}
              >
                <span className="avatar">
                  {clientRow.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{clientRow.fullName}</strong>
                  <small>
                    {clientRow.phone || clientRow.email || 'Контакты не указаны'}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
            {clients.isPending && (
              <div className="empty-state compact">Загружаем клиентов…</div>
            )}
            {!clients.isPending && !clients.data?.length && (
              <div className="empty-state compact">Клиенты не найдены</div>
            )}
          </div>
        </section>

        {selectedClientId ? (
          <ClientProfilePanel
            client={client.data}
            error={
              client.error
                ? apiError(client.error)
                : clientOrders.error
                  ? apiError(clientOrders.error)
                  : ''
            }
            loading={client.isPending || clientOrders.isPending}
            orders={clientOrders.data ?? []}
            onClose={() => navigate('/clients')}
            onNewOrder={() =>
              navigate(`/orders?clientId=${encodeURIComponent(selectedClientId)}`)
            }
            onOpenOrder={(orderId) => navigate(`/orders/${orderId}`)}
          />
        ) : (
          <section className="panel client-profile-placeholder">
            <span>◉</span>
            <h2>Выберите клиента</h2>
            <p>Справа появятся контакты, активные заказы и полная история обращений.</p>
          </section>
        )}
      </div>

      {createOpen && (
        <ClientPickerModal
          onClose={() => setCreateOpen(false)}
          onSelect={(client) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] })
            navigate(`/clients/${client.id}`)
          }}
        />
      )}
    </div>
  )
}
