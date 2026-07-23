import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { ClientPickerModal } from './ClientPickerModal.jsx'
import { apiError, money, openApiDocument } from './workspace-utils.js'

const findName = (rows, id) => rows?.find((row) => row.id === id)?.name

export function OrdersPage() {
  const queryClient = useQueryClient()
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [orderForm, setOrderForm] = useState({
    clientId: '',
    branchId: '',
    acceptanceLocationId: '',
    dueAt: '',
    notes: '',
  })
  const [itemForm, setItemForm] = useState({
    nomenclatureItemId: '',
    materialId: '',
    colorId: '',
    description: '',
    quantity: '1',
    length: '',
    width: '',
    defectIds: [],
    contaminationIds: [],
  })
  const [actionError, setActionError] = useState('')

  const context = useQuery({
    queryKey: ['auth-context'],
    queryFn: async () => (await apiClient.get('/auth/context')).data.data,
  })
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await apiClient.get('/clients?pageSize=100')).data.data,
  })
  const orders = useQuery({
    queryKey: ['orders', orderSearch, orderStatus],
    queryFn: async () =>
      (
        await apiClient.get('/orders', {
          params: {
            pageSize: 100,
            search: orderSearch || undefined,
            status: orderStatus || undefined,
          },
        })
      ).data.data,
  })
  const garments = useQuery({
    queryKey: ['catalog', 'garment-types'],
    queryFn: async () => (await apiClient.get('/catalog/garment-types')).data.data,
  })
  const nomenclature = useQuery({
    queryKey: ['nomenclature'],
    queryFn: async () => (await apiClient.get('/nomenclature')).data.data,
  })
  const materials = useQuery({
    queryKey: ['catalog', 'materials'],
    queryFn: async () => (await apiClient.get('/catalog/materials')).data.data,
  })
  const colors = useQuery({
    queryKey: ['catalog', 'colors'],
    queryFn: async () => (await apiClient.get('/catalog/colors')).data.data,
  })
  const defects = useQuery({
    queryKey: ['catalog', 'defects'],
    queryFn: async () => (await apiClient.get('/catalog/defects')).data.data,
  })
  const contaminations = useQuery({
    queryKey: ['catalog', 'contaminations'],
    queryFn: async () => (await apiClient.get('/catalog/contaminations')).data.data,
  })
  const priceLists = useQuery({
    queryKey: ['price-lists'],
    queryFn: async () => (await apiClient.get('/price-lists')).data.data,
  })
  const activePriceList = priceLists.data?.find((row) => row.status === 'active')
  const prices = useQuery({
    queryKey: ['price-list', activePriceList?.id],
    queryFn: async () =>
      (await apiClient.get(`/price-lists/${activePriceList.id}`)).data.data,
    enabled: Boolean(activePriceList),
  })
  const order = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: async () => (await apiClient.get(`/orders/${selectedOrderId}`)).data.data,
    enabled: Boolean(selectedOrderId),
  })

  const branches = context.data?.branches ?? []
  const effectiveBranchId = orderForm.branchId || branches[0]?.id || ''
  const locations =
    branches.find((branch) => branch.id === effectiveBranchId)?.locations ?? []
  const effectiveLocationId = orderForm.acceptanceLocationId || locations[0]?.id || ''
  const selectedClient = clients.data?.find((client) => client.id === orderForm.clientId)
  const createOrder = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post('/orders', {
          clientId: orderForm.clientId,
          branchId: effectiveBranchId,
          acceptanceLocationId: effectiveLocationId,
          dueAt: orderForm.dueAt ? new Date(orderForm.dueAt).toISOString() : null,
          notes: orderForm.notes || null,
        })
      ).data.data,
    onSuccess: (created) => {
      setSelectedOrderId(created.id)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  const addItem = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post(`/orders/${selectedOrderId}/items`, {
          nomenclatureItemId: itemForm.nomenclatureItemId,
          materialId: itemForm.materialId || null,
          colorId: itemForm.colorId || null,
          description: itemForm.description || null,
          quantity: itemForm.quantity || undefined,
          length: itemForm.length || undefined,
          width: itemForm.width || undefined,
          defectIds: itemForm.defectIds,
          contaminationIds: itemForm.contaminationIds,
        })
      ).data.data,
    onSuccess: () => {
      setItemForm({
        nomenclatureItemId: '',
        materialId: '',
        colorId: '',
        description: '',
        quantity: '1',
        length: '',
        width: '',
        defectIds: [],
        contaminationIds: [],
      })
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
    },
  })
  const acceptOrder = useMutation({
    mutationFn: () =>
      apiClient.post(
        `/orders/${selectedOrderId}/accept`,
        {},
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  const removeItem = useMutation({
    mutationFn: (itemId) => apiClient.delete(`/orders/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  const cancelOrder = useMutation({
    mutationFn: () =>
      apiClient.post(`/orders/${selectedOrderId}/cancel`, {
        reason: 'Отменено из рабочего места приёмки',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const openDocument = async (url, type) => {
    setActionError('')
    try {
      await openApiDocument(apiClient, url, type)
    } catch (error) {
      setActionError(apiError(error))
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Новый заказ</p>
            <h2>Приёмка</h2>
          </div>
          {selectedOrderId && (
            <button className="secondary-button" onClick={() => setSelectedOrderId('')}>
              Новый черновик
            </button>
          )}
        </div>

        {!selectedOrderId ? (
          <div className="order-create-card">
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                createOrder.mutate()
              }}
            >
              <div className="client-selection field-wide">
                {selectedClient ? (
                  <div>
                    <span className="avatar">
                      {selectedClient.fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <small>Клиент заказа</small>
                      <strong>{selectedClient.fullName}</strong>
                      <em>
                        {selectedClient.phone ||
                          selectedClient.email ||
                          'Контакты не указаны'}
                      </em>
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="client-placeholder">◎</span>
                    <span>
                      <small>Клиент не выбран</small>
                      <strong>Найдите или создайте клиента</strong>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setClientPickerOpen(true)}
                >
                  {selectedClient ? 'Сменить клиента' : 'Выбрать клиента'}
                </button>
              </div>
              <label>
                Филиал
                <select
                  required
                  value={effectiveBranchId}
                  onChange={(event) =>
                    setOrderForm((value) => ({
                      ...value,
                      branchId: event.target.value,
                      acceptanceLocationId: '',
                    }))
                  }
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Точка приёмки
                <select
                  required
                  value={effectiveLocationId}
                  onChange={(event) =>
                    setOrderForm((value) => ({
                      ...value,
                      acceptanceLocationId: event.target.value,
                    }))
                  }
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Срок готовности
                <input
                  type="datetime-local"
                  value={orderForm.dueAt}
                  onChange={(event) =>
                    setOrderForm((value) => ({ ...value, dueAt: event.target.value }))
                  }
                />
              </label>
              <label>
                Комментарий
                <input
                  value={orderForm.notes}
                  onChange={(event) =>
                    setOrderForm((value) => ({ ...value, notes: event.target.value }))
                  }
                />
              </label>
              {createOrder.error && (
                <p className="form-error field-wide">{apiError(createOrder.error)}</p>
              )}
              <button
                className="primary-button field-wide"
                disabled={
                  !orderForm.clientId || !effectiveLocationId || createOrder.isPending
                }
              >
                Создать черновик заказа
              </button>
            </form>
          </div>
        ) : (
          <OrderEditor
            order={order.data}
            loading={order.isPending}
            garments={garments.data ?? []}
            nomenclature={nomenclature.data ?? []}
            materials={materials.data ?? []}
            colors={colors.data ?? []}
            defects={defects.data ?? []}
            contaminations={contaminations.data ?? []}
            prices={prices.data?.items ?? []}
            itemForm={itemForm}
            setItemForm={setItemForm}
            addItem={addItem}
            removeItem={removeItem}
            acceptOrder={acceptOrder}
            cancelOrder={cancelOrder}
            onOpenDocument={openDocument}
            actionError={actionError}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
              queryClient.invalidateQueries({ queryKey: ['orders'] })
            }}
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Заказы</h2>
          <span>{orders.data?.length ?? 0} записей</span>
        </div>
        <div className="orders-toolbar">
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Номер заказа, клиент или телефон"
          />
          <select
            value={orderStatus}
            onChange={(event) => setOrderStatus(event.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="draft">Черновики</option>
            <option value="accepted">Приняты</option>
            <option value="in_progress">В работе</option>
            <option value="ready">Готовы</option>
            <option value="issued">Выданы</option>
            <option value="cancelled">Отменены</option>
          </select>
        </div>
        <div className="data-list clickable-list">
          {(orders.data ?? []).map((row) => (
            <article key={row.id} onClick={() => setSelectedOrderId(row.id)}>
              <div>
                <strong>{row.displayNumber}</strong>
                <span>
                  {row.client?.fullName || 'Клиент'}{' '}
                  {row.client?.phone ? `· ${row.client.phone}` : ''}
                </span>
                <span>{new Date(row.createdAt).toLocaleString('ru-RU')}</span>
              </div>
              <div className="row-end">
                <strong>{money(row.totalAmount)}</strong>
                <span className="status-pill">{row.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      {clientPickerOpen && (
        <ClientPickerModal
          onClose={() => setClientPickerOpen(false)}
          onSelect={(client) => {
            queryClient.setQueryData(['clients'], (current = []) => {
              if (current.some((row) => row.id === client.id)) return current
              return [client, ...current]
            })
            setOrderForm((value) => ({ ...value, clientId: client.id }))
          }}
        />
      )}
    </div>
  )
}

function OrderEditor({
  order,
  loading,
  garments,
  nomenclature,
  materials,
  colors,
  defects,
  contaminations,
  prices,
  itemForm,
  setItemForm,
  addItem,
  removeItem,
  acceptOrder,
  cancelOrder,
  onOpenDocument,
  actionError,
  onChanged,
}) {
  if (loading || !order) return <div className="empty-state compact">Загружаем…</div>
  const editable = order.status === 'draft'
  const selectedPosition = nomenclature.find(
    (row) => row.id === itemForm.nomenclatureItemId,
  )
  const calculatedQuantity =
    selectedPosition?.unit === 'square_meter'
      ? Number(itemForm.length || 0) * Number(itemForm.width || 0)
      : selectedPosition?.unit === 'linear_meter'
        ? Number(itemForm.length || 0)
        : Number(itemForm.quantity || 0)
  const calculatedTotal =
    (calculatedQuantity * Number(selectedPosition?.unitPrice || 0)) / 100

  return (
    <div className="order-editor">
      <div className="order-summary">
        <div>
          <span className="status-pill">{order.status}</span>
          <h2>{order.displayNumber}</h2>
          <p>{order.client?.fullName}</p>
        </div>
        <div className="order-total">
          <span>Итого</span>
          <strong>{money(order.totalAmount)}</strong>
        </div>
      </div>

      {editable && (
        <form
          className="order-item-form"
          onSubmit={(event) => {
            event.preventDefault()
            addItem.mutate()
          }}
        >
          <div className="form-grid">
            <label className="field-wide">
              Позиция номенклатуры
              <select
                required
                value={itemForm.nomenclatureItemId}
                onChange={(event) =>
                  setItemForm((value) => ({
                    ...value,
                    nomenclatureItemId: event.target.value,
                    quantity: '1',
                    length: '',
                    width: '',
                  }))
                }
              >
                <option value="">Выберите позицию</option>
                {nomenclature.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} — {money(row.unitPrice)} /{' '}
                    {
                      {
                        piece: 'шт.',
                        square_meter: 'м²',
                        linear_meter: 'пог. м',
                        kilogram: 'кг',
                      }[row.unit]
                    }
                  </option>
                ))}
              </select>
            </label>
            <ChoiceChecks
              title="Дефекты при приёмке"
              rows={defects}
              selected={itemForm.defectIds}
              onChange={(defectIds) => setItemForm((value) => ({ ...value, defectIds }))}
            />
            <ChoiceChecks
              title="Загрязнения"
              rows={contaminations}
              selected={itemForm.contaminationIds}
              onChange={(contaminationIds) =>
                setItemForm((value) => ({ ...value, contaminationIds }))
              }
            />
            {selectedPosition?.unit === 'square_meter' && (
              <>
                <label>
                  Длина, м
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={itemForm.length}
                    onChange={(event) =>
                      setItemForm((value) => ({
                        ...value,
                        length: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Ширина, м
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={itemForm.width}
                    onChange={(event) =>
                      setItemForm((value) => ({
                        ...value,
                        width: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            )}
            {selectedPosition?.unit === 'linear_meter' && (
              <label className="field-wide">
                Длина, пог. м
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={itemForm.length}
                  onChange={(event) =>
                    setItemForm((value) => ({
                      ...value,
                      length: event.target.value,
                    }))
                  }
                />
              </label>
            )}
            {selectedPosition &&
              ['piece', 'kilogram'].includes(selectedPosition.unit) && (
                <label className="field-wide">
                  {selectedPosition.unit === 'kilogram' ? 'Вес, кг' : 'Количество, шт.'}
                  <input
                    required
                    type="number"
                    min="0.001"
                    step={selectedPosition.unit === 'piece' ? '1' : '0.001'}
                    value={itemForm.quantity}
                    onChange={(event) =>
                      setItemForm((value) => ({
                        ...value,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            <label>
              Материал
              <select
                value={itemForm.materialId}
                onChange={(event) =>
                  setItemForm((value) => ({
                    ...value,
                    materialId: event.target.value,
                  }))
                }
              >
                <option value="">Не указан</option>
                {materials.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Цвет
              <select
                value={itemForm.colorId}
                onChange={(event) =>
                  setItemForm((value) => ({
                    ...value,
                    colorId: event.target.value,
                  }))
                }
              >
                <option value="">Не указан</option>
                {colors.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Описание и особенности
              <input
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
                placeholder="Марка, повреждения, комментарий"
              />
            </label>
          </div>
          {selectedPosition && (
            <div className="item-calculation">
              <span>
                {selectedPosition.unit === 'square_meter'
                  ? `Площадь: ${calculatedQuantity.toLocaleString('ru-RU')} м²`
                  : `Количество: ${calculatedQuantity.toLocaleString('ru-RU')}`}
              </span>
              <span>Цена: {money(selectedPosition.unitPrice)}</span>
              <strong>
                Итого:{' '}
                {calculatedTotal.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                })}
              </strong>
            </div>
          )}
          <button className="primary-button">Добавить позицию в заказ</button>
          {addItem.error && <p className="form-error">{apiError(addItem.error)}</p>}
        </form>
      )}

      <div className="order-items">
        {(order.items ?? []).map((item, index) => (
          <article key={item.id} className="order-item-card">
            <div className="order-item-head">
              <div>
                <span>Изделие {index + 1}</span>
                <strong>
                  {item.nomenclature?.name ||
                    findName(garments, item.garmentTypeId) ||
                    'Изделие'}
                </strong>
                <small>
                  {[findName(materials, item.materialId), findName(colors, item.colorId)]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <strong>{money(item.totalAmount)}</strong>
            </div>
            {item.description && <p>{item.description}</p>}
            {item.nomenclature && (
              <div className="item-measurements">
                {item.area && <span>{item.area} м²</span>}
                {!item.area && item.quantity && (
                  <span>
                    {item.quantity}{' '}
                    {{
                      piece: 'шт.',
                      linear_meter: 'пог. м',
                      kilogram: 'кг',
                    }[item.nomenclature.unit] || ''}
                  </span>
                )}
                {item.length && item.width && (
                  <span>
                    {item.length} × {item.width} м
                  </span>
                )}
                <span>{money(item.unitPrice)} за единицу</span>
              </div>
            )}
            {!!item.defects?.length && (
              <div className="item-flags">
                <strong>Дефекты:</strong>{' '}
                {item.defects.map((row) => row.defect?.name).join(', ')}
              </div>
            )}
            {!!item.contaminations?.length && (
              <div className="item-flags">
                <strong>Загрязнения:</strong>{' '}
                {item.contaminations.map((row) => row.contamination?.name).join(', ')}
              </div>
            )}
            <div className="service-lines">
              {(item.services ?? []).map((service) => (
                <div key={service.id}>
                  <span>
                    {service.serviceName} × {service.quantity}
                  </span>
                  <strong>{money(service.totalPrice)}</strong>
                </div>
              ))}
            </div>
            {editable && !item.nomenclatureItemId && (
              <ServiceAdder item={item} prices={prices} onChanged={onChanged} />
            )}
            <button
              className="text-button"
              onClick={() =>
                onOpenDocument(
                  `/order-items/${item.id}/labels?layout=tag`,
                  'image/svg+xml',
                )
              }
            >
              Открыть бирку 55×55
            </button>
            {editable && (
              <button
                className="text-button danger"
                disabled={removeItem.isPending}
                onClick={() => removeItem.mutate(item.id)}
              >
                Удалить из заказа
              </button>
            )}
          </article>
        ))}
      </div>

      {!order.items?.length && (
        <div className="empty-state compact">Добавьте первую позицию из номенклатуры</div>
      )}
      {actionError && <p className="form-error">{actionError}</p>}
      <div className="order-actions">
        {editable ? (
          <button
            className="primary-button"
            disabled={
              !order.items?.length ||
              order.items.some(
                (item) => !item.nomenclatureItemId && !item.services?.length,
              ) ||
              acceptOrder.isPending
            }
            onClick={() => acceptOrder.mutate()}
          >
            Принять заказ
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={() =>
              onOpenDocument(`/orders/${order.id}/receipt`, 'text/html;charset=utf-8')
            }
          >
            Открыть квитанцию
          </button>
        )}
        {['draft', 'accepted'].includes(order.status) && (
          <button
            className="secondary-button danger-button"
            disabled={cancelOrder.isPending}
            onClick={() => {
              if (window.confirm(`Отменить заказ ${order.displayNumber}?`)) {
                cancelOrder.mutate()
              }
            }}
          >
            Отменить заказ
          </button>
        )}
        {acceptOrder.error && <p className="form-error">{apiError(acceptOrder.error)}</p>}
      </div>
    </div>
  )
}

function ChoiceChecks({ title, rows, selected, onChange }) {
  return (
    <fieldset className="choice-checks">
      <legend>{title}</legend>
      <div>
        {rows.map((row) => (
          <label key={row.id}>
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={() =>
                onChange(
                  selected.includes(row.id)
                    ? selected.filter((id) => id !== row.id)
                    : [...selected, row.id],
                )
              }
            />
            {row.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ServiceAdder({ item, prices, onChanged }) {
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const options = prices.filter((price) => price.garmentTypeId === item.garmentTypeId)
  const addService = useMutation({
    mutationFn: () =>
      apiClient.post(`/orders/items/${item.id}/services`, {
        serviceId,
        quantity,
      }),
    onSuccess: () => {
      setServiceId('')
      setQuantity('1')
      onChanged()
    },
  })

  return (
    <form
      className="service-adder"
      onSubmit={(event) => {
        event.preventDefault()
        addService.mutate()
      }}
    >
      <select
        required
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
      >
        <option value="">Выберите услугу</option>
        {options.map((price) => (
          <option key={price.id} value={price.serviceId}>
            {price.service?.name} — {money(price.price)}
          </option>
        ))}
      </select>
      <input
        required
        min="0.001"
        step="0.001"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <button className="secondary-button">Добавить услугу</button>
      {!options.length && (
        <small className="form-hint">Для изделия нет цены в активном прайсе</small>
      )}
      {addService.error && <p className="form-error">{apiError(addService.error)}</p>}
    </form>
  )
}
