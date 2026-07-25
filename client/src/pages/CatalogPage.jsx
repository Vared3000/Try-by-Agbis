import { zodResolver } from '@hookform/resolvers/zod'
import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { catalogKey } from '../queries/catalog.js'
import { useServices } from '../queries/services.js'
import { listCatalog } from '../services/catalog.js'
import { useArchiveCatalogEntry, useSaveCatalogEntry } from '../mutations/catalog.js'
import { useArchiveService, useSaveService } from '../mutations/services.js'
import { catalogEntrySchema, serviceSchema } from '../schemas/catalog.js'
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
  const [editingEntryId, setEditingEntryId] = useState('')
  const [editingServiceId, setEditingServiceId] = useState('')
  const catalogQueries = useQueries({
    queries: catalogs.map(([path]) => ({
      queryKey: catalogKey(path),
      queryFn: () => listCatalog(path),
    })),
  })
  const services = useServices()
  const {
    register: registerEntry,
    handleSubmit: handleEntrySubmit,
    reset: resetEntry,
    formState: { errors: entryErrors },
  } = useForm({
    resolver: zodResolver(catalogEntrySchema),
    defaultValues: { name: '' },
  })
  const {
    register: registerService,
    handleSubmit: handleServiceSubmit,
    reset: resetService,
    formState: { errors: serviceErrors },
  } = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: emptyService,
  })
  const selectTab = (path) => {
    setActive(path)
    setEditingEntryId('')
    resetEntry({ name: '' })
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
    resetEntry({ name: row.name })
  }
  const openEditService = (row) => {
    setEditingServiceId(row.id)
    resetService({
      code: row.code,
      name: row.name,
      unit: row.unit,
      categoryId: row.categoryId || '',
    })
  }

  const submitEntry = handleEntrySubmit((values) => {
    saveEntry.mutate(
      {
        id: editingEntryId,
        payload: editingEntryId
          ? { name: values.name }
          : {
              code: `CUSTOM_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
              name: values.name,
            },
      },
      {
        onSuccess: () => {
          resetEntry({ name: '' })
          setEditingEntryId('')
        },
      },
    )
  })

  const submitService = handleServiceSubmit((values) => {
    saveService.mutate(
      {
        id: editingServiceId,
        payload: {
          ...values,
          categoryId: values.categoryId || null,
        },
      },
      {
        onSuccess: () => {
          resetService(emptyService)
          setEditingServiceId('')
        },
      },
    )
  })

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
        <form className="inline-form catalog-entry-form" onSubmit={submitEntry}>
          <input {...registerEntry('name')} placeholder="Название" />
          <button className="primary-button" disabled={saveEntry.isPending}>
            {editingEntryId ? 'Сохранить' : 'Добавить'}
          </button>
          {editingEntryId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingEntryId('')
                resetEntry({ name: '' })
              }}
            >
              Отмена
            </button>
          )}
        </form>
        {entryErrors.name && <p className="form-error">{entryErrors.name.message}</p>}
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
                        resetEntry({ name: '' })
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
        <form className="inline-form service-form" onSubmit={submitService}>
          <input {...registerService('code')} placeholder="Код услуги" />
          <input {...registerService('name')} placeholder="Название услуги" />
          <select {...registerService('categoryId')}>
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
                resetService(emptyService)
              }}
            >
              Отмена
            </button>
          )}
        </form>
        {(serviceErrors.code || serviceErrors.name) && (
          <p className="form-error">
            {serviceErrors.code?.message || serviceErrors.name?.message}
          </p>
        )}
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
                          resetService(emptyService)
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
