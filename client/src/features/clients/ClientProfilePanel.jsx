import { money, orderStatusLabel } from '../../pages/workspace-utils.js'

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
    <section className="panel client-profile">
      <div className="client-profile-head">
        <div className="client-profile-identity">
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

      <div className="client-profile-actions">
        <button className="primary-button" onClick={onNewOrder}>
          + Новый заказ этому клиенту
        </button>
        {client.phone && (
          <a className="secondary-button" href={`tel:${client.phone}`}>
            Позвонить
          </a>
        )}
      </div>

      <dl className="client-contact-grid">
        <div>
          <dt>Телефон</dt>
          <dd>{client.phone || 'Не указан'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{client.email || 'Не указан'}</dd>
        </div>
        {primaryAddress && (
          <div className="field-wide">
            <dt>Основной адрес</dt>
            <dd>{primaryAddress.address}</dd>
          </div>
        )}
        {client.notes && (
          <div className="field-wide">
            <dt>Комментарий</dt>
            <dd>{client.notes}</dd>
          </div>
        )}
      </dl>

      <div className="client-metrics">
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

      <div className="client-history-head">
        <div>
          <p className="eyebrow">История</p>
          <h3>Заказы клиента</h3>
        </div>
        <span>{orders.length} записей</span>
      </div>

      <div className="client-order-history">
        {orders.map((order) => (
          <button
            key={order.id}
            className="client-order-row"
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
            <span className="client-order-amount">
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
    </section>
  )
}
