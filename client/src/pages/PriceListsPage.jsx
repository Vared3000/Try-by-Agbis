import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { apiError, money } from './workspace-utils.js'

export function PriceListsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [listForm, setListForm] = useState({
    name: '',
    validFrom: new Date().toISOString().slice(0, 10),
    status: 'active',
  })
  const [itemForm, setItemForm] = useState({
    serviceId: '',
    garmentTypeId: '',
    price: '',
  })
  const lists = useQuery({
    queryKey: ['price-lists'],
    queryFn: async () => (await apiClient.get('/price-lists')).data.data,
  })
  const effectiveId =
    selectedId ||
    lists.data?.find((row) => row.status === 'active')?.id ||
    lists.data?.[0]?.id
  const detail = useQuery({
    queryKey: ['price-list', effectiveId],
    queryFn: async () => (await apiClient.get(`/price-lists/${effectiveId}`)).data.data,
    enabled: Boolean(effectiveId),
  })
  const services = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await apiClient.get('/services')).data.data,
  })
  const garments = useQuery({
    queryKey: ['catalog', 'garment-types'],
    queryFn: async () => (await apiClient.get('/catalog/garment-types')).data.data,
  })
  const createList = useMutation({
    mutationFn: async () => (await apiClient.post('/price-lists', listForm)).data.data,
    onSuccess: (row) => {
      setSelectedId(row.id)
      setListForm((value) => ({ ...value, name: '' }))
      queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
  })
  const addPrice = useMutation({
    mutationFn: () =>
      apiClient.post(`/price-lists/${effectiveId}/items`, {
        serviceId: itemForm.serviceId,
        garmentTypeId: itemForm.garmentTypeId || null,
        price: String(Math.round(Number(itemForm.price.replace(',', '.')) * 100)),
      }),
    onSuccess: () => {
      setItemForm((value) => ({ ...value, price: '' }))
      queryClient.invalidateQueries({ queryKey: ['price-list', effectiveId] })
    },
  })

  return (
    <div className="workspace-grid price-layout">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Тарифы</p>
            <h2>Прайс-листы</h2>
          </div>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            createList.mutate()
          }}
        >
          <label className="field-wide">
            Название
            <input
              required
              value={listForm.name}
              onChange={(event) =>
                setListForm((value) => ({ ...value, name: event.target.value }))
              }
              placeholder="Основной прайс"
            />
          </label>
          <label>
            Действует с
            <input
              type="date"
              required
              value={listForm.validFrom}
              onChange={(event) =>
                setListForm((value) => ({ ...value, validFrom: event.target.value }))
              }
            />
          </label>
          <label>
            Статус
            <select
              value={listForm.status}
              onChange={(event) =>
                setListForm((value) => ({ ...value, status: event.target.value }))
              }
            >
              <option value="draft">Черновик</option>
              <option value="active">Активный</option>
            </select>
          </label>
          {createList.error && (
            <p className="form-error field-wide">{apiError(createList.error)}</p>
          )}
          <button className="primary-button field-wide">Создать прайс-лист</button>
        </form>
        <div className="choice-list">
          {(lists.data ?? []).map((row) => (
            <button
              key={row.id}
              className={effectiveId === row.id ? 'active' : ''}
              onClick={() => setSelectedId(row.id)}
            >
              <span>{row.name}</span>
              <small>
                {row.validFrom} · {row.status}
              </small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Цены</p>
            <h2>{detail.data?.name || 'Выберите прайс-лист'}</h2>
          </div>
          <span>{detail.data?.items?.length ?? 0} цен</span>
        </div>
        {effectiveId && (
          <form
            className="inline-form price-form"
            onSubmit={(event) => {
              event.preventDefault()
              addPrice.mutate()
            }}
          >
            <select
              required
              value={itemForm.garmentTypeId}
              onChange={(event) =>
                setItemForm((value) => ({
                  ...value,
                  garmentTypeId: event.target.value,
                }))
              }
            >
              <option value="">Тип изделия</option>
              {(garments.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              required
              value={itemForm.serviceId}
              onChange={(event) =>
                setItemForm((value) => ({ ...value, serviceId: event.target.value }))
              }
            >
              <option value="">Услуга</option>
              {(services.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={itemForm.price}
              onChange={(event) =>
                setItemForm((value) => ({ ...value, price: event.target.value }))
              }
              placeholder="Цена, ₽"
            />
            <button className="primary-button">Добавить цену</button>
          </form>
        )}
        {addPrice.error && <p className="form-error">{apiError(addPrice.error)}</p>}
        <div className="data-list">
          {(detail.data?.items ?? []).map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.garmentType?.name || 'Любое изделие'}</strong>
                <span>{row.service?.name}</span>
              </div>
              <strong>{money(row.price)}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
