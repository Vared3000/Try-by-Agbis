import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { apiError } from './workspace-utils.js'

const catalogs = [
  ['garment-types', 'Типы изделий'],
  ['materials', 'Материалы'],
  ['colors', 'Цвета'],
  ['defects', 'Дефекты'],
  ['contaminations', 'Загрязнения'],
  ['service-categories', 'Категории услуг'],
]

export function CatalogPage() {
  const queryClient = useQueryClient()
  const [active, setActive] = useState('garment-types')
  const [entry, setEntry] = useState({ code: '', name: '' })
  const [service, setService] = useState({
    code: '',
    name: '',
    unit: 'item',
    categoryId: '',
  })
  const catalogQueries = useQueries({
    queries: catalogs.map(([path]) => ({
      queryKey: ['catalog', path],
      queryFn: async () => (await apiClient.get(`/catalog/${path}`)).data.data,
    })),
  })
  const services = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await apiClient.get('/services')).data.data,
  })
  const createEntry = useMutation({
    mutationFn: () => apiClient.post(`/catalog/${active}`, entry),
    onSuccess: () => {
      setEntry({ code: '', name: '' })
      queryClient.invalidateQueries({ queryKey: ['catalog', active] })
    },
  })
  const createService = useMutation({
    mutationFn: () =>
      apiClient.post('/services', {
        ...service,
        categoryId: service.categoryId || null,
      }),
    onSuccess: () => {
      setService({ code: '', name: '', unit: 'item', categoryId: '' })
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
  const activeIndex = catalogs.findIndex(([path]) => path === active)
  const activeRows = catalogQueries[activeIndex]?.data ?? []
  const categories =
    catalogQueries[catalogs.findIndex(([path]) => path === 'service-categories')]?.data ??
    []

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Номенклатура</p>
            <h2>Справочники приёмки</h2>
          </div>
        </div>
        <div className="tab-row">
          {catalogs.map(([path, label]) => (
            <button
              key={path}
              className={active === path ? 'active' : ''}
              onClick={() => setActive(path)}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            createEntry.mutate()
          }}
        >
          <input
            required
            value={entry.code}
            onChange={(event) =>
              setEntry((value) => ({ ...value, code: event.target.value }))
            }
            placeholder="Код"
          />
          <input
            required
            value={entry.name}
            onChange={(event) =>
              setEntry((value) => ({ ...value, name: event.target.value }))
            }
            placeholder="Название"
          />
          <button className="primary-button">Добавить</button>
        </form>
        {createEntry.error && <p className="form-error">{apiError(createEntry.error)}</p>}
        <div className="chip-list">
          {activeRows.map((row) => (
            <span key={row.id}>
              <code>{row.code}</code> {row.name}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Услуги</h2>
          <span>{services.data?.length ?? 0} позиций</span>
        </div>
        <form
          className="inline-form service-form"
          onSubmit={(event) => {
            event.preventDefault()
            createService.mutate()
          }}
        >
          <input
            required
            value={service.code}
            onChange={(event) =>
              setService((value) => ({ ...value, code: event.target.value }))
            }
            placeholder="Код услуги"
          />
          <input
            required
            value={service.name}
            onChange={(event) =>
              setService((value) => ({ ...value, name: event.target.value }))
            }
            placeholder="Название услуги"
          />
          <select
            value={service.categoryId}
            onChange={(event) =>
              setService((value) => ({ ...value, categoryId: event.target.value }))
            }
          >
            <option value="">Без категории</option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <button className="primary-button">Добавить услугу</button>
        </form>
        {createService.error && (
          <p className="form-error">{apiError(createService.error)}</p>
        )}
        <div className="data-list">
          {(services.data ?? []).map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>
                  {row.code} · {row.category?.name || 'Без категории'}
                </span>
              </div>
              <span className="status-pill">{row.unit}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
