import { useState } from 'react'

import { useServices } from '../queries/services.js'
import { useNomenclature } from '../queries/nomenclature.js'
import { usePriceList, usePriceLists } from '../queries/price-lists.js'
import {
  useAddPriceListItem,
  useArchivePriceList,
  useCreatePriceList,
  useRemovePriceListItem,
  useUpdatePriceList,
  useUpdatePriceListItem,
} from '../mutations/price-lists.js'
import { NomenclatureCombobox } from '../features/orders/NomenclatureCombobox.jsx'
import { ServiceCombobox } from '../features/orders/ServiceCombobox.jsx'
import { apiError, money } from './workspace-utils.js'

const unitLabels = {
  item: 'шт.',
  piece: 'шт.',
  square_meter: 'м²',
  linear_meter: 'пог. м',
  kilogram: 'кг',
}

export function PriceListsPage() {
  const [selectedId, setSelectedId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [showAllStatuses, setShowAllStatuses] = useState(false)
  const [listForm, setListForm] = useState({
    name: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: '',
    status: 'active',
  })
  const [itemForm, setItemForm] = useState({
    kind: 'nomenclature',
    nomenclatureItemId: '',
    serviceId: '',
    price: '',
  })
  const [editingPrice, setEditingPrice] = useState({ id: '', price: '' })
  const lists = usePriceLists()
  const effectiveId =
    selectedId ||
    lists.data?.find((row) => row.status === 'active')?.id ||
    lists.data?.[0]?.id
  const detail = usePriceList(effectiveId)
  const nomenclature = useNomenclature()
  const services = useServices()
  const existingNomenclatureIds = new Set(
    (detail.data?.items ?? []).map((row) => row.nomenclatureItemId).filter(Boolean),
  )
  const availableNomenclature = (nomenclature.data ?? []).filter(
    (row) =>
      row.id === itemForm.nomenclatureItemId || !existingNomenclatureIds.has(row.id),
  )
  const existingGenericServiceIds = new Set(
    (detail.data?.items ?? [])
      .filter((row) => row.serviceId && !row.garmentTypeId)
      .map((row) => row.serviceId),
  )
  const availableServices = (services.data ?? []).filter(
    (row) => row.id === itemForm.serviceId || !existingGenericServiceIds.has(row.id),
  )
  const createList = useCreatePriceList()
  const addPrice = useAddPriceListItem(effectiveId)
  const updateList = useUpdatePriceList(effectiveId)
  const archiveList = useArchivePriceList(effectiveId)
  const updatePrice = useUpdatePriceListItem(effectiveId)
  const removePrice = useRemovePriceListItem(effectiveId)
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
        {!createOpen ? (
          <button className="primary-button" onClick={() => setCreateOpen(true)}>
            + Создать прайс-лист
          </button>
        ) : (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              createList.mutate(
                { ...listForm, validTo: listForm.validTo || null },
                {
                  onSuccess: (row) => {
                    setSelectedId(row.id)
                    setListForm((value) => ({ ...value, name: '' }))
                    setCreateOpen(false)
                  },
                },
              )
            }}
          >
            <label className="field-wide">
              Название
              <input
                autoFocus
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
            <div className="modal-actions field-wide">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreateOpen(false)}
              >
                Отмена
              </button>
              <button className="primary-button" disabled={createList.isPending}>
                {createList.isPending ? 'Создаём…' : 'Создать прайс-лист'}
              </button>
            </div>
          </form>
        )}
        <div className="table-toolbar">
          <strong>Прайс-листы</strong>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowAllStatuses((value) => !value)}
          >
            {showAllStatuses ? 'Только активные' : 'Показать все статусы'}
          </button>
        </div>
        <div className="choice-list">
          {(lists.data ?? [])
            .filter((row) => showAllStatuses || row.status === 'active')
            .map((row) => (
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
            <span>{detail.data?.items?.length ?? 0} позиций</span>
            {detail.data?.status === 'draft' && (
              <button
                className="text-button"
                disabled={updateList.isPending}
                onClick={() => updateList.mutate({ status: 'active' })}
              >
                Активировать
              </button>
            )}
            {detail.data?.status === 'inactive' && (
              <button
                className="text-button"
                disabled={updateList.isPending}
                onClick={() => updateList.mutate({ status: 'draft' })}
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
              addPrice.mutate(
                {
                  ...(itemForm.kind === 'service'
                    ? { serviceId: itemForm.serviceId, garmentTypeId: null }
                    : { nomenclatureItemId: itemForm.nomenclatureItemId }),
                  price: String(Math.round(Number(itemForm.price.replace(',', '.')) * 100)),
                },
                {
                  onSuccess: () => {
                    setItemForm((value) => ({
                      kind: value.kind,
                      nomenclatureItemId: '',
                      serviceId: '',
                      price: '',
                    }))
                  },
                },
              )
            }}
          >
            <div
              className="price-kind-switch field-wide"
              role="group"
              aria-label="Тип цены"
            >
              <button
                type="button"
                className={itemForm.kind === 'nomenclature' ? 'active' : ''}
                onClick={() =>
                  setItemForm({
                    kind: 'nomenclature',
                    nomenclatureItemId: '',
                    serviceId: '',
                    price: '',
                  })
                }
              >
                Изделие из номенклатуры
              </button>
              <button
                type="button"
                className={itemForm.kind === 'service' ? 'active' : ''}
                onClick={() =>
                  setItemForm({
                    kind: 'service',
                    nomenclatureItemId: '',
                    serviceId: '',
                    price: '',
                  })
                }
              >
                Дополнительная услуга
              </button>
            </div>
            {itemForm.kind === 'nomenclature' ? (
              <NomenclatureCombobox
                items={availableNomenclature}
                value={itemForm.nomenclatureItemId}
                onChange={(nomenclatureItemId) => {
                  const selected = nomenclature.data?.find(
                    (row) => row.id === nomenclatureItemId,
                  )
                  setItemForm((value) => ({
                    ...value,
                    nomenclatureItemId,
                    price: selected ? String(Number(selected.unitPrice) / 100) : '',
                  }))
                }}
              />
            ) : (
              <ServiceCombobox
                items={availableServices}
                label="Дополнительная услуга"
                value={itemForm.serviceId}
                onChange={(serviceId) =>
                  setItemForm((value) => ({ ...value, serviceId }))
                }
              />
            )}
            <label>
              Цена за единицу, ₽
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={itemForm.price}
                onChange={(event) =>
                  setItemForm((value) => ({ ...value, price: event.target.value }))
                }
                placeholder="590"
              />
            </label>
            <button
              className="primary-button"
              disabled={
                !(itemForm.kind === 'service'
                  ? itemForm.serviceId
                  : itemForm.nomenclatureItemId) || addPrice.isPending
              }
            >
              {addPrice.isPending ? 'Добавляем…' : 'Добавить в прайс'}
            </button>
            {itemForm.kind === 'nomenclature' &&
              !nomenclature.isPending &&
              !availableNomenclature.length && (
                <p className="form-hint field-wide">
                  Все позиции номенклатуры уже добавлены в этот прайс-лист.
                </p>
              )}
            {itemForm.kind === 'service' &&
              !services.isPending &&
              !availableServices.length && (
                <p className="form-hint field-wide">
                  Все дополнительные услуги уже добавлены в этот прайс-лист.
                </p>
              )}
          </form>
        )}
        {addPrice.error && <p className="form-error">{apiError(addPrice.error)}</p>}
        {updateList.error && <p className="form-error">{apiError(updateList.error)}</p>}
        {archiveList.error && <p className="form-error">{apiError(archiveList.error)}</p>}
        <div className="data-list">
          {(detail.data?.items ?? []).map((row) => (
            <article key={row.id}>
              <div>
                <strong>
                  {row.nomenclature?.name ||
                    (row.service && row.garmentType
                      ? `${row.service.name} · ${row.garmentType.name}`
                      : row.service?.name) ||
                    row.garmentType?.name ||
                    'Позиция'}
                </strong>
                <span>
                  {row.nomenclature
                    ? `Цена за ${unitLabels[row.nomenclature.unit] || row.nomenclature.unit}`
                    : row.service
                      ? row.garmentType
                        ? `Услуга для типа изделия · ${unitLabels[row.service.unit] || row.service.unit}`
                        : `Дополнительная услуга · за ${unitLabels[row.service.unit] || row.service.unit}`
                      : 'Старая строка прайса'}
                </span>
              </div>
              {editingPrice.id === row.id ? (
                <form
                  className="price-row-editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    updatePrice.mutate(
                      {
                        itemId: editingPrice.id,
                        payload: {
                          price: String(
                            Math.round(
                              Number(String(editingPrice.price).replace(',', '.')) * 100,
                            ),
                          ),
                        },
                      },
                      {
                        onSuccess: () => {
                          setEditingPrice({ id: '', price: '' })
                        },
                      },
                    )
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
                    aria-label={`Цена для ${
                      row.nomenclature?.name || row.service?.name || 'позиции'
                    }`}
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
