import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

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
import {
  priceEditSchema,
  priceListCreateSchema,
  priceListItemSchema,
} from '../schemas/price-lists.js'
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
  const [editingPriceId, setEditingPriceId] = useState('')
  const {
    register: registerList,
    handleSubmit: handleListSubmit,
    reset: resetListForm,
    formState: { errors: listErrors },
  } = useForm({
    resolver: zodResolver(priceListCreateSchema),
    defaultValues: {
      name: '',
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: '',
      status: 'active',
    },
  })
  const {
    register: registerItem,
    handleSubmit: handleItemSubmit,
    reset: resetItemForm,
    setValue: setItemFormValue,
    control: itemFormControl,
    formState: { errors: itemErrors },
  } = useForm({
    resolver: zodResolver(priceListItemSchema),
    defaultValues: {
      kind: 'nomenclature',
      nomenclatureItemId: '',
      serviceId: '',
      price: '',
    },
  })
  const itemForm = useWatch({ control: itemFormControl })
  const {
    register: registerEditPrice,
    handleSubmit: handleEditPriceSubmit,
    reset: resetEditPrice,
    formState: { errors: editPriceErrors },
  } = useForm({
    resolver: zodResolver(priceEditSchema),
    defaultValues: { price: '' },
  })
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

  const submitList = handleListSubmit((values) => {
    createList.mutate(
      { ...values, validTo: values.validTo || null },
      {
        onSuccess: (row) => {
          setSelectedId(row.id)
          resetListForm({ ...values, name: '' })
          setCreateOpen(false)
        },
      },
    )
  })

  const submitItem = handleItemSubmit((values) => {
    addPrice.mutate(
      {
        ...(values.kind === 'service'
          ? { serviceId: values.serviceId, garmentTypeId: null }
          : { nomenclatureItemId: values.nomenclatureItemId }),
        price: String(Math.round(Number(values.price.replace(',', '.')) * 100)),
      },
      {
        onSuccess: () => {
          resetItemForm({
            kind: values.kind,
            nomenclatureItemId: '',
            serviceId: '',
            price: '',
          })
        },
      },
    )
  })

  const submitEditPrice = handleEditPriceSubmit((values) => {
    updatePrice.mutate(
      {
        itemId: editingPriceId,
        payload: {
          price: String(Math.round(Number(String(values.price).replace(',', '.')) * 100)),
        },
      },
      {
        onSuccess: () => {
          setEditingPriceId('')
          resetEditPrice({ price: '' })
        },
      },
    )
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
        {!createOpen ? (
          <button className="primary-button" onClick={() => setCreateOpen(true)}>
            + Создать прайс-лист
          </button>
        ) : (
          <form className="form-grid" onSubmit={submitList}>
            <label className="field-wide">
              Название
              <input autoFocus {...registerList('name')} placeholder="Основной прайс" />
              {listErrors.name && (
                <small className="field-error">{listErrors.name.message}</small>
              )}
            </label>
            <label>
              Действует с
              <input type="date" {...registerList('validFrom')} />
            </label>
            <label>
              Статус
              <select {...registerList('status')}>
                <option value="draft">Черновик</option>
                <option value="active">Активный</option>
              </select>
            </label>
            <label className="field-wide">
              Действует до
              <input type="date" {...registerList('validTo')} />
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
          <form className="inline-form price-form" onSubmit={submitItem}>
            <div
              className="price-kind-switch field-wide"
              role="group"
              aria-label="Тип цены"
            >
              <button
                type="button"
                className={itemForm.kind === 'nomenclature' ? 'active' : ''}
                onClick={() =>
                  resetItemForm({
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
                  resetItemForm({
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
              <Controller
                control={itemFormControl}
                name="nomenclatureItemId"
                render={({ field }) => (
                  <NomenclatureCombobox
                    items={availableNomenclature}
                    value={field.value}
                    onChange={(nomenclatureItemId) => {
                      const selected = nomenclature.data?.find(
                        (row) => row.id === nomenclatureItemId,
                      )
                      field.onChange(nomenclatureItemId)
                      setItemFormValue(
                        'price',
                        selected ? String(Number(selected.unitPrice) / 100) : '',
                      )
                    }}
                  />
                )}
              />
            ) : (
              <Controller
                control={itemFormControl}
                name="serviceId"
                render={({ field }) => (
                  <ServiceCombobox
                    items={availableServices}
                    label="Дополнительная услуга"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
            <label>
              Цена за единицу, ₽
              <input
                min="0"
                step="0.01"
                type="number"
                {...registerItem('price')}
                placeholder="590"
              />
              {itemErrors.price && (
                <small className="field-error">{itemErrors.price.message}</small>
              )}
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
              {editingPriceId === row.id ? (
                <form className="price-row-editor" onSubmit={submitEditPrice}>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    {...registerEditPrice('price')}
                    aria-label={`Цена для ${
                      row.nomenclature?.name || row.service?.name || 'позиции'
                    }`}
                  />
                  {editPriceErrors.price && (
                    <small className="field-error">{editPriceErrors.price.message}</small>
                  )}
                  <button className="text-button" disabled={updatePrice.isPending}>
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditingPriceId('')}
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
                        onClick={() => {
                          setEditingPriceId(row.id)
                          resetEditPrice({ price: String(Number(row.price) / 100) })
                        }}
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
