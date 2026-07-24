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
    validTo: '',
    status: 'active',
  })
  const [itemForm, setItemForm] = useState({
    serviceId: '',
    garmentTypeId: '',
    price: '',
  })
  const [editingPrice, setEditingPrice] = useState({ id: '', price: '' })
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
    mutationFn: async () =>
      (
        await apiClient.post('/price-lists', {
          ...listForm,
          validTo: listForm.validTo || null,
        })
      ).data.data,
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
  const updateList = useMutation({
    mutationFn: (status) => apiClient.patch(`/price-lists/${effectiveId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] })
      queryClient.invalidateQueries({ queryKey: ['price-list', effectiveId] })
    },
  })
  const archiveList = useMutation({
    mutationFn: () => apiClient.delete(`/price-lists/${effectiveId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] })
      queryClient.invalidateQueries({ queryKey: ['price-list', effectiveId] })
    },
  })
  const updatePrice = useMutation({
    mutationFn: () =>
      apiClient.patch(`/price-lists/${effectiveId}/items/${editingPrice.id}`, {
        price: String(
          Math.round(Number(String(editingPrice.price).replace(',', '.')) * 100),
        ),
      }),
    onSuccess: () => {
      setEditingPrice({ id: '', price: '' })
      queryClient.invalidateQueries({ queryKey: ['price-list', effectiveId] })
    },
  })
  const removePrice = useMutation({
    mutationFn: (itemId) =>
      apiClient.delete(`/price-lists/${effectiveId}/items/${itemId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['price-list', effectiveId] }),
  })
  const editable = detail.data?.status !== 'inactive'

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
          <label className="field-wide">
            Действует до
            <input
              type="date"
              value={listForm.validTo}
              min={listForm.validFrom}
              onChange={(event) =>
                setListForm((value) => ({ ...value, validTo: event.target.value }))
              }
            />
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
                {row.validFrom}
                {row.validTo ? ` — ${row.validTo}` : ''} ·{' '}
                {{
                  draft: 'черновик',
                  active: 'активный',
                  inactive: 'неактивный',
                }[row.status] || row.status}
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
          <div className="price-list-actions">
            <span>{detail.data?.items?.length ?? 0} цен</span>
            {detail.data?.status === 'draft' && (
              <button
                className="text-button"
                disabled={updateList.isPending}
                onClick={() => updateList.mutate('active')}
              >
                Активировать
              </button>
            )}
            {detail.data?.status === 'inactive' && (
              <button
                className="text-button"
                disabled={updateList.isPending}
                onClick={() => updateList.mutate('draft')}
              >
                Вернуть в черновики
              </button>
            )}
            {detail.data?.status === 'active' && (
              <button
                className="text-button danger"
                disabled={archiveList.isPending}
                onClick={() => archiveList.mutate()}
              >
                Отключить
              </button>
            )}
          </div>
        </div>
        {effectiveId && editable && (
          <form
            className="inline-form price-form"
            onSubmit={(event) => {
              event.preventDefault()
              addPrice.mutate()
            }}
          >
            <select
              value={itemForm.garmentTypeId}
              onChange={(event) =>
                setItemForm((value) => ({
                  ...value,
                  garmentTypeId: event.target.value,
                }))
              }
            >
              <option value="">Любое изделие</option>
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
        {updateList.error && <p className="form-error">{apiError(updateList.error)}</p>}
        {archiveList.error && <p className="form-error">{apiError(archiveList.error)}</p>}
        <div className="data-list">
          {(detail.data?.items ?? []).map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.garmentType?.name || 'Любое изделие'}</strong>
                <span>{row.service?.name}</span>
              </div>
              {editingPrice.id === row.id ? (
                <form
                  className="price-row-editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    updatePrice.mutate()
                  }}
                >
                  <input
                    required
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingPrice.price}
                    onChange={(event) =>
                      setEditingPrice((value) => ({
                        ...value,
                        price: event.target.value,
                      }))
                    }
                    aria-label={`Цена для ${row.service?.name}`}
                  />
                  <button className="text-button" disabled={updatePrice.isPending}>
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditingPrice({ id: '', price: '' })}
                  >
                    Отмена
                  </button>
                </form>
              ) : (
                <div className="price-row-actions">
                  <strong>{money(row.price)}</strong>
                  {editable && (
                    <>
                      <button
                        className="text-button"
                        onClick={() =>
                          setEditingPrice({
                            id: row.id,
                            price: String(Number(row.price) / 100),
                          })
                        }
                      >
                        Изменить
                      </button>
                      <button
                        className="text-button danger"
                        disabled={removePrice.isPending}
                        onClick={() => removePrice.mutate(row.id)}
                      >
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
        {updatePrice.error && <p className="form-error">{apiError(updatePrice.error)}</p>}
        {removePrice.error && <p className="form-error">{apiError(removePrice.error)}</p>}
      </section>
    </div>
  )
}
