import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '../api/client.js'
import {
  ChoiceChecks,
  ItemPhotos,
  ServiceAdder,
} from '../features/orders/OrderItemControls.jsx'
import { OrderCreatePanel } from '../features/orders/OrderCreatePanel.jsx'
import { OrderListPanel } from '../features/orders/OrderListPanel.jsx'
import { OrderMetaEditor } from '../features/orders/OrderMetaEditor.jsx'
import { useOrderHotkeys } from '../features/orders/useOrderHotkeys.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { ClientPickerModal } from './ClientPickerModal.jsx'
import { apiError, money, openApiDocument, orderStatusLabel } from './workspace-utils.js'

const findName = (rows, id) => rows?.find((row) => row.id === id)?.name
const finalOrderStatuses = new Set(['issued', 'cancelled'])

export function OrdersPage() {
  const queryClient = useQueryClient()
  const itemSelectRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const selectedOrderId = location.pathname.match(/^\/orders\/([^/]+)$/)?.[1] || ''
  const searchParams = new URLSearchParams(location.search)
  const orderStatus = searchParams.get('status') || ''
  const requestedClientId = searchParams.get('clientId') || ''
  const setSelectedOrderId = (id) =>
    navigate(id ? `/orders/${id}${location.search}` : '/orders')
  const setOrderStatus = (status) =>
    navigate(
      `${location.pathname}${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    )
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const debouncedOrderSearch = useDebouncedValue(orderSearch)
  const [orderForm, setOrderForm] = useState({
    clientId: requestedClientId,
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
  const requestedClient = useQuery({
    queryKey: ['client', requestedClientId],
    queryFn: async () => (await apiClient.get(`/clients/${requestedClientId}`)).data.data,
    enabled: Boolean(requestedClientId),
  })
  const orders = useQuery({
    queryKey: ['orders', debouncedOrderSearch, orderStatus],
    queryFn: async () => {
      const rows = (
        await apiClient.get('/orders', {
          params: {
            pageSize: 100,
            search: debouncedOrderSearch || undefined,
            status: orderStatus || undefined,
          },
        })
      ).data.data
      const loadedAt = Date.now()
      return rows.map((row) => ({
        ...row,
        isOverdue:
          Boolean(row.dueAt) &&
          !finalOrderStatuses.has(row.status) &&
          new Date(row.dueAt).getTime() < loadedAt,
      }))
    },
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
  const selectedClient =
    clients.data?.find((client) => client.id === orderForm.clientId) ??
    (requestedClient.data?.id === orderForm.clientId ? requestedClient.data : null)
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
      navigate(`/orders/${created.id}`)
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
  const updateOrder = useMutation({
    mutationFn: (input) => apiClient.patch(`/orders/${selectedOrderId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
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
  const issueOrder = useMutation({
    mutationFn: ({ itemIds, reason }) =>
      apiClient.post(
        `/orders/${selectedOrderId}/issues`,
        {
          itemIds,
          paymentOverrideReason: reason || null,
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
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
  const canAcceptOrder =
    order.data?.status === 'draft' &&
    Boolean(order.data.items?.length) &&
    !order.data.items.some((item) => !item.nomenclatureItemId && !item.services?.length)
  useOrderHotkeys({
    onNewOrder: () => navigate('/orders'),
    onAddItem: () => {
      itemSelectRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      itemSelectRef.current?.focus()
    },
    onAcceptOrder: () => acceptOrder.mutate(),
    onPrintReceipt: () =>
      openDocument(`/orders/${selectedOrderId}/receipt`, 'text/html;charset=utf-8'),
    canAddItem: order.data?.status === 'draft',
    canAcceptOrder,
    canPrintReceipt: Boolean(selectedOrderId),
  })

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
              Новый черновик <kbd>F2</kbd>
            </button>
          )}
        </div>

        {!selectedOrderId ? (
          <OrderCreatePanel
            branches={branches}
            effectiveBranchId={effectiveBranchId}
            effectiveLocationId={effectiveLocationId}
            errorMessage={createOrder.error ? apiError(createOrder.error) : ''}
            form={orderForm}
            isPending={createOrder.isPending}
            locations={locations}
            onChooseClient={() => setClientPickerOpen(true)}
            onFormChange={(changes) =>
              setOrderForm((value) => ({ ...value, ...changes }))
            }
            onSubmit={() => createOrder.mutate()}
            selectedClient={selectedClient}
          />
        ) : (
          <OrderEditor
            key={selectedOrderId}
            order={order.data}
            loading={order.isPending}
            garments={garments.data ?? []}
            nomenclature={nomenclature.data ?? []}
            materials={materials.data ?? []}
            colors={colors.data ?? []}
            defects={defects.data ?? []}
            contaminations={contaminations.data ?? []}
            prices={prices.data?.items ?? []}
            itemSelectRef={itemSelectRef}
            itemForm={itemForm}
            setItemForm={setItemForm}
            addItem={addItem}
            updateOrder={updateOrder}
            removeItem={removeItem}
            acceptOrder={acceptOrder}
            cancelOrder={cancelOrder}
            issueOrder={issueOrder}
            onOpenDocument={openDocument}
            actionError={actionError}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] })
              queryClient.invalidateQueries({ queryKey: ['orders'] })
            }}
          />
        )}
      </section>

      <OrderListPanel
        orders={orders.data ?? []}
        loading={orders.isPending}
        search={orderSearch}
        status={orderStatus}
        selectedOrderId={selectedOrderId}
        onSearchChange={setOrderSearch}
        onStatusChange={setOrderStatus}
        onOpenOrder={setSelectedOrderId}
      />
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
  itemSelectRef,
  itemForm,
  setItemForm,
  addItem,
  updateOrder,
  removeItem,
  acceptOrder,
  cancelOrder,
  issueOrder,
  onOpenDocument,
  actionError,
  onChanged,
}) {
  const [selectedIssueIds, setSelectedIssueIds] = useState(null)
  const [issueReason, setIssueReason] = useState('')
  const [metaOpen, setMetaOpen] = useState(false)
  if (loading || !order) return <div className="empty-state compact">Загружаем…</div>
  const editable = order.status === 'draft'
  const readyItems = order.items?.filter((item) => item.status === 'ready') ?? []
  const effectiveIssueIds =
    selectedIssueIds === null
      ? readyItems.map((item) => item.id)
      : selectedIssueIds.filter((id) => readyItems.some((item) => item.id === id))
  const debt = Number(order.totalAmount) - Number(order.paidAmount)
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
          <span className="status-pill">{orderStatusLabel(order.status)}</span>
          <h2>{order.displayNumber}</h2>
          <p>{order.client?.fullName}</p>
          {order.dueAt && (
            <p>Срок готовности: {new Date(order.dueAt).toLocaleString('ru-RU')}</p>
          )}
          {order.notes && <p>Комментарий: {order.notes}</p>}
          {editable && (
            <button className="text-button" onClick={() => setMetaOpen(true)}>
              Изменить клиента, срок и комментарий
            </button>
          )}
        </div>
        <div className="order-total">
          <span>Итого</span>
          <strong>{money(order.totalAmount)}</strong>
          <small>Оплачено: {money(order.paidAmount)}</small>
          {debt > 0 && <small className="debt-text">Долг: {money(debt)}</small>}
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
                ref={itemSelectRef}
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
          <button className="primary-button">
            Добавить позицию в заказ <kbd>F4</kbd>
          </button>
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
                <small>
                  {item.area
                    ? `${item.area} м²`
                    : item.quantity
                      ? `${item.quantity} ${
                          {
                            piece: 'шт.',
                            linear_meter: 'пог. м',
                            kilogram: 'кг',
                          }[item.nomenclature?.unit] || ''
                        }`
                      : ''}
                </small>
              </div>
              <strong>{money(item.totalAmount)}</strong>
            </div>
            {item.status === 'ready' && (
              <label className="issue-checkbox">
                <input
                  type="checkbox"
                  checked={effectiveIssueIds.includes(item.id)}
                  onChange={() => {
                    const current = effectiveIssueIds
                    setSelectedIssueIds(
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }}
                />
                Выдать эту позицию
              </label>
            )}
            <details
              className="order-item-details"
              open={editable && !item.nomenclatureItemId ? true : undefined}
            >
              <summary>
                <span>Детали позиции</span>
                <small>
                  {[
                    item.defects?.length && `${item.defects.length} деф.`,
                    item.contaminations?.length &&
                      `${item.contaminations.length} загрязн.`,
                    item.files?.length && `${item.files.length} фото`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Размеры, услуги и фотографии'}
                </small>
              </summary>
              <div className="order-item-details-content">
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
                <ItemPhotos item={item} editable={editable} onChanged={onChanged} />
                {editable && !item.nomenclatureItemId && (
                  <ServiceAdder item={item} prices={prices} onChanged={onChanged} />
                )}
              </div>
            </details>
            <button
              className="text-button"
              onClick={() =>
                onOpenDocument(
                  `/order-items/${item.id}/labels?layout=tag`,
                  'image/svg+xml',
                )
              }
            >
              Печать бирки 55×55
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
      {!!readyItems.length && (
        <section className="issue-panel">
          <div>
            <p className="eyebrow">Выдача</p>
            <h3>
              Выбрано {effectiveIssueIds.length} из {readyItems.length} готовых позиций
            </h3>
          </div>
          {debt > 0 && (
            <label>
              Причина выдачи с долгом {money(debt)}
              <input
                required
                value={issueReason}
                onChange={(event) => setIssueReason(event.target.value)}
                placeholder="Например, разрешение руководителя"
              />
            </label>
          )}
          <button
            className="primary-button"
            disabled={
              !effectiveIssueIds.length ||
              (debt > 0 && !issueReason.trim()) ||
              issueOrder.isPending
            }
            onClick={() =>
              issueOrder.mutate({
                itemIds: effectiveIssueIds,
                reason: issueReason.trim(),
              })
            }
          >
            Подтвердить выдачу
          </button>
          {issueOrder.error && <p className="form-error">{apiError(issueOrder.error)}</p>}
        </section>
      )}
      <div className="order-actions">
        {editable && (
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
            Принять заказ <kbd>Ctrl+Enter</kbd>
          </button>
        )}
        <button
          className={editable ? 'secondary-button' : 'primary-button'}
          onClick={() =>
            onOpenDocument(`/orders/${order.id}/receipt`, 'text/html;charset=utf-8')
          }
        >
          Печать квитанции <kbd>F8</kbd>
        </button>
        <button
          className="secondary-button"
          disabled={!order.items?.length}
          onClick={() =>
            onOpenDocument(`/orders/${order.id}/labels`, 'text/html;charset=utf-8')
          }
        >
          Печать всех бирок ({order.items?.length ?? 0})
        </button>
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
      {metaOpen && (
        <OrderMetaEditor
          order={order}
          updateOrder={updateOrder}
          onClose={() => setMetaOpen(false)}
        />
      )}
    </div>
  )
}
