import { useState } from 'react'

import { money, orderStatusLabel } from '../../pages/workspace-utils.js'
import { ClientEditModal } from './ClientEditModal.jsx'
import styles from './ClientProfilePanel.module.css'

const finalStatuses = new Set(['issued', 'cancelled'])

export function ClientProfilePanel({
  client,
  error,
  loading,
  orders,
  onClose,
  onNewOrder,
  onOpenOrder,
}) {
  const [editOpen, setEditOpen] = useState(false)
  if (loading) {
    return <section className="panel empty-state">Загружаем карточку клиента…</section>
  }
  if (error || !client) {
    return (
      <section className="panel empty-state">
        <h2>Карточка клиента недоступна</h2>
        <p>{error || 'Клиент не найден'}</p>
        <button className="secondary-button" onClick={onClose}>
          Вернуться к списку
        </button>
      </section>
    )
  }

  const activeOrders = orders.filter((order) => !finalStatuses.has(order.status))
  const totalAmount = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  )
  const primaryAddress = client.addresses?.find((address) => address.isPrimary)

  return (
    <section className={`panel ${styles.clientProfile}`}>
      <div className={styles.clientProfileHead}>
        <div className={styles.clientProfileIdentity}>
          <span className="avatar">{client.fullName.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="eyebrow">Карточка клиента</p>
            <h2>{client.fullName}</h2>
            <span>Клиент с {new Date(client.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть карточку">
          ×
        </button>
      </div>

      <div className={styles.clientProfileActions}>
        <button className="primary-button" onClick={onNewOrder}>
          + Новый заказ этому клиенту
        </button>
        {client.phone && (
          <a className="secondary-button" href={`tel:${client.phone}`}>
            Позвонить
          </a>
        )}
        <button className="secondary-button" onClick={() => setEditOpen(true)}>
          Изменить карточку
        </button>
      </div>

      <dl className={styles.clientContactGrid}>
        <div>
          <dt>Телефон</dt>
          <dd>{client.phone || 'Не указан'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{client.email || 'Не указан'}</dd>
        </div>
        <div className="field-wide">
          <dt>Адрес доставки</dt>
          <dd>{primaryAddress?.address || 'Не указан'}</dd>
        </div>
        {client.notes && (
          <div className="field-wide">
            <dt>Комментарий</dt>
            <dd>{client.notes}</dd>
          </div>
        )}
      </dl>

      <div className={styles.clientMetrics}>
        <div>
          <span>Всего заказов</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>Активных</span>
          <strong>{activeOrders.length}</strong>
        </div>
        <div>
          <span>Сумма заказов</span>
          <strong>{money(totalAmount)}</strong>
        </div>
      </div>

      <div className={styles.clientHistoryHead}>
        <div>
          <p className="eyebrow">История</p>
          <h3>Заказы клиента</h3>
        </div>
        <span>{orders.length} записей</span>
      </div>

      <div className={styles.clientOrderHistory}>
        {orders.map((order) => (
          <button
            key={order.id}
            className={styles.clientOrderRow}
            onClick={() => onOpenOrder(order.id)}
          >
            <span>
              <strong>{order.displayNumber}</strong>
              <small>{new Date(order.createdAt).toLocaleString('ru-RU')}</small>
            </span>
            <span>
              <strong>{order.items?.length ?? 0} поз.</strong>
              <small>
                {order.dueAt
                  ? `Срок ${new Date(order.dueAt).toLocaleDateString('ru-RU')}`
                  : 'Без срока'}
              </small>
            </span>
            <span className={styles.clientOrderAmount}>
              <strong>{money(order.totalAmount)}</strong>
              <span className={`status-pill status-${order.status}`}>
                {orderStatusLabel(order.status)}
              </span>
            </span>
          </button>
        ))}
        {!orders.length && (
          <div className="empty-state compact">
            <p>У клиента пока нет заказов.</p>
            <button className="text-button" onClick={onNewOrder}>
              Создать первый заказ
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <ClientEditModal client={client} onClose={() => setEditOpen(false)} />
      )}
    </section>
  )
}
