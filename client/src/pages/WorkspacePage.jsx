import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '../api/client.js'
import { useAuth } from '../app/auth-context.js'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { useFinancialReport, useOperationalReport } from '../queries/reports.js'
import styles from './WorkspacePage.module.css'
import { money, orderStatusLabel } from './workspace-utils.js'

const CatalogPage = lazy(() =>
  import('./CatalogPage.jsx').then((m) => ({ default: m.CatalogPage })),
)
const ClientsPage = lazy(() =>
  import('./ClientsPage.jsx').then((m) => ({ default: m.ClientsPage })),
)
const NomenclaturePage = lazy(() =>
  import('./NomenclaturePage.jsx').then((m) => ({ default: m.NomenclaturePage })),
)
const OrdersPage = lazy(() =>
  import('./OrdersPage.jsx').then((m) => ({ default: m.OrdersPage })),
)
const PriceListsPage = lazy(() =>
  import('./PriceListsPage.jsx').then((m) => ({ default: m.PriceListsPage })),
)
const ProductionPage = lazy(() =>
  import('./ProductionPage.jsx').then((m) => ({ default: m.ProductionPage })),
)
const TransfersPage = lazy(() =>
  import('./TransfersPage.jsx').then((m) => ({ default: m.TransfersPage })),
)

const navigation = [
  ['overview', 'Обзор', '⌂'],
  ['clients', 'Клиенты', '◉'],
  ['orders', 'Заказы', '▤'],
  ['nomenclature', 'Номенклатура', '◆'],
  ['catalog', 'Параметры заказа', '◇'],
  ['pricing', 'Прайс-листы', '₽'],
  ['production', 'Производство', '⌁'],
  ['transfers', 'Перемещения', '⇄'],
  ['cash', 'Касса', '₽'],
  ['reports', 'Отчёты', '◫'],
  ['notifications', 'Уведомления', '●'],
]

const endpoints = {
  notifications: '/notifications',
}

export function WorkspacePage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pathSection = location.pathname.split('/').filter(Boolean)[0] || 'overview'
  const section = navigation.some(([id]) => id === pathSection) ? pathSection : 'overview'
  const openOrders = (status = '') => {
    navigate(status ? `/orders?status=${encodeURIComponent(status)}` : '/orders')
  }
  const list = useQuery({
    queryKey: ['workspace', section],
    queryFn: async () => (await apiClient.get(endpoints[section])).data.data,
    enabled: Boolean(endpoints[section]),
  })
  const operational = useOperationalReport({
    enabled: section === 'overview' || section === 'reports',
  })
  const financial = useFinancialReport({
    enabled: section === 'overview' || section === 'reports',
  })

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className="logo-mark small">CF</span>
          <div>
            <strong>CleanFlow</strong>
            <span>ERP для химчистки</span>
          </div>
        </div>
        <nav>
          {navigation.map(([id, label, icon]) => (
            <button
              key={id}
              className={section === id ? 'active' : ''}
              onClick={() => navigate(id === 'overview' ? '/' : `/${id}`)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarUser}>
          <span className="avatar">
            {auth.user?.displayName?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{auth.user?.displayName}</strong>
            <span>{auth.user?.roleCodes?.join(', ')}</span>
          </div>
          <button onClick={auth.signOut} title="Выйти">
            ↗
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <p className="eyebrow">Рабочее пространство</p>
            <h1>{navigation.find(([id]) => id === section)?.[1]}</h1>
          </div>
          <span className="online-badge">● Система работает</span>
        </header>

        {(section === 'overview' || section === 'reports') && (
          <section className={styles.metricGrid}>
            <Metric
              label="Заказов"
              value={operational.data?.totalOrders ?? '—'}
              hint="во всех доступных филиалах"
              onClick={() => openOrders()}
            />
            <Metric
              label="Готовы к выдаче"
              value={operational.data?.byStatus?.ready ?? 0}
              hint="требуют внимания"
              accent
              onClick={() => openOrders('ready')}
            />
            <Metric
              label="Чистая выручка"
              value={financial.data ? money(financial.data.netAmount) : '—'}
              hint={`${financial.data?.paymentCount ?? 0} оплат`}
            />
          </section>
        )}

        {section === 'overview' && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Статусы</p>
                <h2>Заказы по этапам</h2>
              </div>
            </div>
            <div className={styles.statusGrid}>
              {Object.entries(operational.data?.byStatus ?? {}).map(([status, count]) => (
                <button
                  className={styles.statusCard}
                  key={status}
                  onClick={() => openOrders(status)}
                >
                  <strong>{count}</strong>
                  <span>{orderStatusLabel(status)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <ErrorBoundary resetKey={section}>
          <Suspense fallback={<div className="empty-state compact">Загружаем раздел…</div>}>
            {section === 'production' && <ProductionPage />}
            {section === 'transfers' && <TransfersPage />}

            {section === 'clients' && <ClientsPage />}
            {section === 'orders' && <OrdersPage />}
            {section === 'nomenclature' && <NomenclaturePage />}
            {section === 'catalog' && <CatalogPage />}
            {section === 'pricing' && <PriceListsPage />}
            {section === 'notifications' && (
              <DataList section={section} data={list.data} loading={list.isPending} />
            )}

            {section === 'cash' && (
              <section className="panel empty-state">
                <span>₽</span>
                <h2>Кассовые операции</h2>
                <p>
                  Открывайте смену из рабочего места приёмки. Оплаты и возвраты доступны
                  внутри карточки заказа.
                </p>
              </section>
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

function Metric({ label, value, hint, accent = false, onClick }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </>
  )
  return onClick ? (
    <button
      className={`${styles.metricCard} ${styles.metricButton} ${accent ? styles.accent : ''}`}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <article className={`${styles.metricCard} ${accent ? styles.accent : ''}`}>
      {content}
    </article>
  )
}

function DataList({ section, data = [], loading }) {
  const title = {
    notifications: 'Центр уведомлений',
  }[section]
  if (loading) return <section className="panel empty-state">Загружаем…</section>
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <span>{data.length} записей</span>
      </div>
      {!data.length ? (
        <div className="empty-state">Пока нет данных</div>
      ) : (
        <div className="data-list">
          {data.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.fullName || row.displayNumber || row.type || row.id}</strong>
                <span>{row.phone || row.status || row.channel}</span>
              </div>
              <span className="status-pill">
                {row.status ? orderStatusLabel(row.status) : 'Активно'}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
