import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../api/client.js'
import { apiError, money, openApiDocument } from './workspace-utils.js'

const findName = (rows, id) => rows?.find((row) => row.id === id)?.name

export function OrdersPage() {
  const queryClient = useQueryClient()
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [clientForm, setClientForm] = useState({ fullName: '', phone: '' })
  const [orderForm, setOrderForm] = useState({
    clientId: '',
    branchId: '',
    acceptanceLocationId: '',
    dueAt: '',
    notes: '',
  })
  const [itemForm, setItemForm] = useState({
    garmentTypeId: '',
    materialId: '',
    colorId: '',
    description: '',
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
    queryKey: ['orders'],
    queryFn: async () => (await apiClient.get('/orders?pageSize=100')).data.data,
  })
  const garments = useQuery({
    queryKey: ['catalog', 'garment-types'],
    queryFn: async () => (await apiClient.get('/catalog/garment-types')).data.data,
  })
  const materials = useQuery({
    queryKey: ['catalog', 'materials'],
    queryFn: async () => (await apiClient.get('/catalog/materials')).data.data,
  })
  const colors = useQuery({
    queryKey: ['catalog', 'colors'],
    queryFn: async () => (await apiClient.get('/catalog/colors')).data.data,
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

  const createClient = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post('/clients', {
          fullName: clientForm.fullName,
          phone: clientForm.phone || null,
        })
      ).data.data,
    onSuccess: (client) => {
      setOrderForm((value) => ({ ...value, clientId: client.id }))
      setClientForm({ fullName: '', phone: '' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
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
          garmentTypeId: itemForm.garmentTypeId,
          materialId: itemForm.materialId || null,
          colorId: itemForm.colorId || null,
          description: itemForm.description || null,
        })
      ).data.data,
    onSuccess: () => {
      setItemForm({
        garmentTypeId: '',
        materialId: '',
        colorId: '',
        description: '',
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
          <div className="order-create-layout">
            <form
              className="form-grid subpanel"
              onSubmit={(event) => {
                event.preventDefault()
                createClient.mutate()
              }}
            >
              <div className="field-wide">
                <strong>Быстро создать клиента</strong>
                <small>Если клиента ещё нет в базе</small>
              </div>
              <label>
                ФИО
                <input
                  required
                  value={clientForm.fullName}
                  onChange={(event) =>
                    setClientForm((value) => ({
                      ...value,
                      fullName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Телефон
                <input
                  value={clientForm.phone}
                  onChange={(event) =>
                    setClientForm((value) => ({ ...value, phone: event.target.value }))
                  }
                />
              </label>
              <button className="secondary-button field-wide">
                Создать и выбрать клиента
              </button>
              {createClient.error && (
                <p className="form-error field-wide">{apiError(createClient.error)}</p>
              )}
            </form>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                createOrder.mutate()
              }}
            >
              <label className="field-wide">
                Клиент
                <select
                  required
                  value={orderForm.clientId}
                  onChange={(event) =>
                    setOrderForm((value) => ({
                      ...value,
                      clientId: event.target.value,
                    }))
                  }
                >
                  <option value="">Выберите клиента</option>
                  {(clients.data ?? []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName} {client.phone ? `· ${client.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
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
                disabled={!effectiveLocationId || createOrder.isPending}
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
            materials={materials.data ?? []}
            colors={colors.data ?? []}
            prices={prices.data?.items ?? []}
            itemForm={itemForm}
            setItemForm={setItemForm}
            addItem={addItem}
            acceptOrder={acceptOrder}
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
        <div className="data-list clickable-list">
          {(orders.data ?? []).map((row) => (
            <article key={row.id} onClick={() => setSelectedOrderId(row.id)}>
              <div>
                <strong>{row.displayNumber}</strong>
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
    </div>
  )
}

function OrderEditor({
  order,
  loading,
  garments,
  materials,
  colors,
  prices,
  itemForm,
  setItemForm,
  addItem,
  acceptOrder,
  onOpenDocument,
  actionError,
  onChanged,
}) {
  if (loading || !order) return <div className="empty-state compact">Загружаем…</div>
  const editable = order.status === 'draft'

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
          className="inline-form item-form"
          onSubmit={(event) => {
            event.preventDefault()
            addItem.mutate()
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
            {garments.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            value={itemForm.materialId}
            onChange={(event) =>
              setItemForm((value) => ({ ...value, materialId: event.target.value }))
            }
          >
            <option value="">Материал</option>
            {materials.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            value={itemForm.colorId}
            onChange={(event) =>
              setItemForm((value) => ({ ...value, colorId: event.target.value }))
            }
          >
            <option value="">Цвет</option>
            {colors.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <input
            value={itemForm.description}
            onChange={(event) =>
              setItemForm((value) => ({ ...value, description: event.target.value }))
            }
            placeholder="Описание, марка, особенности"
          />
          <button className="primary-button">Добавить изделие</button>
          {addItem.error && <p className="form-error">{apiError(addItem.error)}</p>}
        </form>
      )}

      <div className="order-items">
        {(order.items ?? []).map((item, index) => (
          <article key={item.id} className="order-item-card">
            <div className="order-item-head">
              <div>
                <span>Изделие {index + 1}</span>
                <strong>{findName(garments, item.garmentTypeId) || 'Изделие'}</strong>
                <small>
                  {[findName(materials, item.materialId), findName(colors, item.colorId)]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <strong>{money(item.totalAmount)}</strong>
            </div>
            {item.description && <p>{item.description}</p>}
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
            {editable && (
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
          </article>
        ))}
      </div>

      {!order.items?.length && (
        <div className="empty-state compact">
          Добавьте первое изделие, затем выберите для него услугу
        </div>
      )}
      {actionError && <p className="form-error">{actionError}</p>}
      <div className="order-actions">
        {editable ? (
          <button
            className="primary-button"
            disabled={
              !order.items?.length ||
              order.items.some((item) => !item.services?.length) ||
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
        {acceptOrder.error && <p className="form-error">{apiError(acceptOrder.error)}</p>}
      </div>
    </div>
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
