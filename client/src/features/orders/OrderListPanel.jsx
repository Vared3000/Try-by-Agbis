import { money, orderStatusLabel } from '../../pages/workspace-utils.js'
import styles from './OrderListPanel.module.css'

const statusFilters = [
  ['', 'Все'],
  ['draft', 'Черновики'],
  ['accepted', 'Приняты'],
  ['partially_ready', 'Частично готовы'],
  ['ready', 'Готовы'],
  ['partially_issued', 'Частично выданы'],
  ['issued', 'Выданы'],
  ['cancelled', 'Отменены'],
]

export function OrderListPanel({
  orders,
  loading,
  search,
  status,
  selectedOrderId,
  onSearchChange,
  onStatusChange,
  onOpenOrder,
}) {
  return (
    <section className="panel order-list-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Рабочая очередь</p>
          <h2>Заказы</h2>
        </div>
        <span>{orders.length} записей</span>
      </div>

      <div className={styles.ordersToolbar}>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Номер заказа, клиент или телефон"
          aria-label="Поиск заказов"
        />
        <div className={styles.orderFilterChips} aria-label="Фильтр статусов">
          {statusFilters.map(([value, label]) => (
            <button
              key={value || 'all'}
              className={status === value ? 'active' : ''}
              onClick={() => onStatusChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.orderListTable}>
        <div className={styles.orderListHead} aria-hidden="true">
          <span>Заказ и клиент</span>
          <span>Срок</span>
          <span>Сумма и статус</span>
        </div>
        {orders.map((order) => {
          return (
            <button
              key={order.id}
              className={`${styles.orderListRow} ${selectedOrderId === order.id ? 'active' : ''}`}
              onClick={() => onOpenOrder(order.id)}
              aria-current={selectedOrderId === order.id ? 'true' : undefined}
            >
              <span className={styles.orderListMain}>
                <strong>{order.displayNumber}</strong>
                <span>
                  {order.client?.fullName || 'Клиент'}
                  {order.client?.phone ? ` · ${order.client.phone}` : ''}
                </span>
                <small>{new Date(order.createdAt).toLocaleString('ru-RU')}</small>
              </span>
              <span className={`${styles.orderDue} ${order.isOverdue ? 'overdue' : ''}`}>
                {order.dueAt
                  ? new Date(order.dueAt).toLocaleDateString('ru-RU')
                  : 'Не указан'}
                {order.isOverdue && <small>Просрочен</small>}
              </span>
              <span className={styles.orderListTotal}>
                <strong>{money(order.totalAmount)}</strong>
                <span className={`status-pill status-${order.status}`}>
                  {orderStatusLabel(order.status)}
                </span>
              </span>
            </button>
          )
        })}
        {loading && <div className="empty-state compact">Загружаем заказы…</div>}
        {!loading && !orders.length && (
          <div className="empty-state compact">Заказы не найдены</div>
        )}
      </div>
    </section>
  )
}
