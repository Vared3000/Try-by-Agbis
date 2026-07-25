import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'

import { catalogKey } from '../queries/catalog.js'
import { useServices } from '../queries/services.js'
import { listCatalog } from '../services/catalog.js'
import { useArchiveCatalogEntry, useSaveCatalogEntry } from '../mutations/catalog.js'
import { useArchiveService, useSaveService } from '../mutations/services.js'
import { apiError } from './workspace-utils.js'

const catalogs = [
  ['materials', 'Материалы'],
  ['colors', 'Цвета'],
  ['contaminations', 'Загрязнения'],
  ['service-categories', 'Категории доп. услуг'],
]

const emptyService = { code: '', name: '', unit: 'item', categoryId: '' }

export function CatalogPage() {
  const [active, setActive] = useState('materials')
  const [entry, setEntry] = useState({ name: '' })
  const [editingEntryId, setEditingEntryId] = useState('')
  const [service, setService] = useState(emptyService)
  const [editingServiceId, setEditingServiceId] = useState('')
  const catalogQueries = useQueries({
    queries: catalogs.map(([path]) => ({
      queryKey: catalogKey(path),
      queryFn: () => listCatalog(path),
    })),
  })
  const services = useServices()
  const selectTab = (path) => {
    setActive(path)
    setEditingEntryId('')
    setEntry({ name: '' })
  }
  const saveEntry = useSaveCatalogEntry(active)
  const archiveEntry = useArchiveCatalogEntry(active)
  const saveService = useSaveService()
  const archiveService = useArchiveService()
  const activeIndex = catalogs.findIndex(([path]) => path === active)
  const activeRows = catalogQueries[activeIndex]?.data ?? []
  const categories =
    catalogQueries[catalogs.findIndex(([path]) => path === 'service-categories')]?.data ??
    []

  const openEditEntry = (row) => {
    setEditingEntryId(row.id)
    setEntry({ name: row.name })
  }
  const openEditService = (row) => {
    setEditingServiceId(row.id)
    setService({
      code: row.code,
      name: row.name,
      unit: row.unit,
      categoryId: row.categoryId || '',
    })
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Настройки заказа</p>
            <h2>Параметры приёмки</h2>
            <p>
              Эти значения появляются в заказе в полях «Материал», «Цвет»,
              «Загрязнение» и «Дополнительные услуги». Сами изделия создаются в
              номенклатуре, а их цены — в прайс-листах.
            </p>
          </div>
        </div>
        <div className="tab-row">
          {catalogs.map(([path, label]) => (
            <button
              key={path}
              className={active === path ? 'active' : ''}
              onClick={() => selectTab(path)}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="inline-form catalog-entry-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveEntry.mutate(
              {
                id: editingEntryId,
                payload: editingEntryId
                  ? { name: entry.name }
                  : {
                      code: `CUSTOM_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
                      name: entry.name,
                    },
              },
              {
                onSuccess: () => {
                  setEntry({ name: '' })
                  setEditingEntryId('')
                },
              },
            )
          }}
        >
          <input
            required
            value={entry.name}
            onChange={(event) =>
              setEntry((value) => ({ ...value, name: event.target.value }))
            }
            placeholder="Название"
          />
          <button className="primary-button" disabled={saveEntry.isPending}>
            {editingEntryId ? 'Сохранить' : 'Добавить'}
          </button>
          {editingEntryId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingEntryId('')
                setEntry({ name: '' })
              }}
            >
              Отмена
            </button>
          )}
        </form>
        {saveEntry.error && <p className="form-error">{apiError(saveEntry.error)}</p>}
        <div className="chip-list">
          {activeRows.map((row) => (
            <span key={row.id} className={editingEntryId === row.id ? 'active' : ''}>
              <button
                type="button"
                className="link-button"
                onClick={() => openEditEntry(row)}
              >
                {row.name}
              </button>
              <button
                type="button"
                className="chip-remove"
                aria-label={`В архив: ${row.name}`}
                disabled={archiveEntry.isPending}
                onClick={() =>
                  archiveEntry.mutate(row.id, {
                    onSuccess: () => {
                      if (editingEntryId === row.id) {
                        setEditingEntryId('')
                        setEntry({ name: '' })
                      }
                    },
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Дополнительные услуги</h2>
            <p>Например: глажение, удаление пятен или защитная пропитка.</p>
          </div>
          <span>{services.data?.length ?? 0} позиций</span>
        </div>
        <form
          className="inline-form service-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveService.mutate(
              {
                id: editingServiceId,
                payload: {
                  ...service,
                  categoryId: service.categoryId || null,
                },
              },
              {
                onSuccess: () => {
                  setService(emptyService)
                  setEditingServiceId('')
                },
              },
            )
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
          <button className="primary-button" disabled={saveService.isPending}>
            {editingServiceId ? 'Сохранить услугу' : 'Добавить услугу'}
          </button>
          {editingServiceId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingServiceId('')
                setService(emptyService)
              }}
            >
              Отмена
            </button>
          )}
        </form>
        {saveService.error && <p className="form-error">{apiError(saveService.error)}</p>}
        <div className="data-list">
          {(services.data ?? []).map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.category?.name || 'Без категории'}</span>
              </div>
              <span className="table-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openEditService(row)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="text-button danger"
                  disabled={archiveService.isPending}
                  onClick={() =>
                    archiveService.mutate(row.id, {
                      onSuccess: () => {
                        if (editingServiceId === row.id) {
                          setEditingServiceId('')
                          setService(emptyService)
                        }
                      },
                    })
                  }
                >
                  В архив
                </button>
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
