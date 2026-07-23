import { useQuery } from '@tanstack/react-query'

import { getHealth } from '../api/client.js'
import styles from './InfrastructurePage.module.css'

export function InfrastructurePage() {
  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => getHealth({ signal }),
  })

  const status = health.isPending
    ? 'Проверяем API…'
    : health.isError
      ? 'API недоступен'
      : 'Инфраструктура работает'

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            CF
          </span>
          <div>
            <p className={styles.eyebrow}>CleanFlow ERP</p>
            <h1>Основа для чистого процесса</h1>
          </div>
        </div>

        <p className={styles.summary}>
          Инфраструктурный каркас готов к следующему этапу: проектированию базы данных и
          миграций.
        </p>

        <div
          className={styles.status}
          data-state={health.isError ? 'error' : health.isSuccess ? 'ready' : 'pending'}
          role="status"
        >
          <span className={styles.statusDot} aria-hidden="true" />
          <div>
            <strong>{status}</strong>
            <span>
              {health.data?.service
                ? `${health.data.service} · ${health.data.environment}`
                : 'Ожидание ответа сервера'}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
