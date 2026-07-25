import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '../api/client.js'
import { useAuthContext } from '../queries/auth-context.js'
import { useCatalog } from '../queries/catalog.js'
import { useNomenclature } from '../queries/nomenclature.js'
import { clientsKey, useClient, useClients } from '../queries/clients.js'
import { usePriceList, usePriceLists } from '../queries/price-lists.js'
import { orderKey, useOrder, useOrders } from '../queries/orders.js'
import {
  useAcceptOrder,
  useAddOrderItem,
  useCancelOrder,
  useCreateOrder,
  useIssueOrderItems,
  useRemoveOrderItem,
  useUpdateOrder,
  useUpdateOrderItemWorkStatus,
} from '../mutations/orders.js'
import { OrderCreatePanel } from '../features/orders/OrderCreatePanel.jsx'
import { OrderEditor } from '../features/orders/OrderEditor.jsx'
import { OrderListPanel } from '../features/orders/OrderListPanel.jsx'
import { useOrderHotkeys } from '../features/orders/useOrderHotkeys.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { orderCreateSchema } from '../schemas/orders.js'
import { ClientPickerModal } from './ClientPickerModal.jsx'
import { apiError, isClientFacingLocation, openApiDocument } from './workspace-utils.js'

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
  const [createFormOpen, setCreateFormOpen] = useState(Boolean(requestedClientId))
  const [orderSearch, setOrderSearch] = useState('')
  const debouncedOrderSearch = useDebouncedValue(orderSearch)
  const today = new Date().toISOString().slice(0, 10)
  const {
    control: orderFormControl,
    register: registerOrderForm,
    handleSubmit: handleOrderFormSubmit,
    setValue: setOrderFormValue,
    formState: { errors: orderFormErrors, isSubmitting: orderFormSubmitting },
  } = useForm({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      clientId: requestedClientId,
      branchId: '',
      acceptanceLocationId: '',
      issueLocationId: '',
      priceListId: '',
      acceptedOn: today,
      dueAt: '',
      urgency: 'normal',
      notificationPhone: '',
      isRework: false,
      notes: '',
    },
  })
  const orderForm = useWatch({ control: orderFormControl })
  const [actionError, setActionError] = useState('')

  const context = useAuthContext()
  const clients = useClients()
  const requestedClient = useClient(requestedClientId)
  const orders = useOrders(debouncedOrderSearch, orderStatus)
  const garments = useCatalog('garment-types')
  const nomenclature = useNomenclature()
  const materials = useCatalog('materials')
  const colors = useCatalog('colors')
  const defects = useCatalog('defects')
  const contaminations = useCatalog('contaminations')
  const priceLists = usePriceLists()
  const activePriceLists = (priceLists.data ?? []).filter(
    (row) =>
      row.status === 'active' &&
      row.validFrom <= today &&
      (!row.validTo || row.validTo >= today),
  )
  const order = useOrder(selectedOrderId)
  const effectivePriceListId =
    order.data?.priceListId || orderForm.priceListId || activePriceLists[0]?.id || ''
  const prices = usePriceList(effectivePriceListId)
  const pricedNomenclature = (nomenclature.data ?? []).map((row) => {
    const override = prices.data?.items?.find(
      (price) => price.nomenclatureItemId === row.id,
    )
    return override ? { ...row, unitPrice: override.price } : row
  })

  const branches = context.data?.branches ?? []
  const effectiveBranchId = orderForm.branchId || branches[0]?.id || ''
  const locations = (
    branches.find((branch) => branch.id === effectiveBranchId)?.locations ?? []
  ).filter(isClientFacingLocation)
  const effectiveLocationId = orderForm.acceptanceLocationId || locations[0]?.id || ''
  const issueLocations = branches.flatMap((branch) =>
    (branch.locations ?? [])
      .filter(isClientFacingLocation)
      .map((location) => ({
        ...location,
        branchName: branch.name,
      })),
  )
  const effectiveIssueLocationId =
    orderForm.issueLocationId || effectiveLocationId || issueLocations[0]?.id || ''
  const selectedClient =
    clients.data?.find((client) => client.id === orderForm.clientId) ??
    (requestedClient.data?.id === orderForm.clientId ? requestedClient.data : null)
  const createOrder = useCreateOrder()
  const addItem = useAddOrderItem(selectedOrderId)
  const updateOrder = useUpdateOrder(selectedOrderId)
  const acceptOrder = useAcceptOrder(selectedOrderId)
  const removeItem = useRemoveOrderItem(selectedOrderId)
  const cancelOrder = useCancelOrder(selectedOrderId)
  const issueOrder = useIssueOrderItems(selectedOrderId)
  const updateItemWorkStatus = useUpdateOrderItemWorkStatus(selectedOrderId)

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
            <button
              className="secondary-button"
              onClick={() => {
                setSelectedOrderId('')
                setCreateFormOpen(false)
              }}
            >
              Новый черновик <kbd>F2</kbd>
            </button>
          )}
        </div>

        {selectedOrderId ? (
          <OrderEditor
            key={selectedOrderId}
            order={order.data}
            loading={order.isPending}
            branches={branches}
            garments={garments.data ?? []}
            nomenclature={pricedNomenclature}
            materials={materials.data ?? []}
            colors={colors.data ?? []}
            defects={defects.data ?? []}
            contaminations={contaminations.data ?? []}
            prices={prices.data?.items ?? []}
            priceLists={activePriceLists}
            itemSelectRef={itemSelectRef}
            addItem={addItem}
            updateOrder={updateOrder}
            removeItem={removeItem}
            acceptOrder={acceptOrder}
            cancelOrder={cancelOrder}
            issueOrder={issueOrder}
            updateItemWorkStatus={updateItemWorkStatus}
            onOpenDocument={openDocument}
            actionError={actionError}
            onChanged={() =>
              Promise.all([
                queryClient.invalidateQueries({
                  queryKey: orderKey(selectedOrderId),
                }),
                queryClient.invalidateQueries({ queryKey: ['orders'] }),
              ])
            }
          />
        ) : createFormOpen ? (
          <OrderCreatePanel
            control={orderFormControl}
            register={registerOrderForm}
            errors={orderFormErrors}
            watchedClientId={orderForm.clientId}
            effectiveLocationId={effectiveLocationId}
            effectivePriceListId={effectivePriceListId}
            errorMessage={createOrder.error ? apiError(createOrder.error) : ''}
            isPending={createOrder.isPending}
            isSubmitting={orderFormSubmitting}
            issueLocations={issueLocations}
            locations={locations}
            priceLists={activePriceLists}
            onChooseClient={() => setClientPickerOpen(true)}
            onSubmit={handleOrderFormSubmit((values) =>
              createOrder.mutate(
                {
                  clientId: values.clientId,
                  branchId: effectiveBranchId,
                  acceptanceLocationId: effectiveLocationId,
                  issueLocationId: effectiveIssueLocationId,
                  priceListId: effectivePriceListId || null,
                  acceptedOn: values.acceptedOn || today,
                  dueAt: values.dueAt
                    ? new Date(`${values.dueAt}T18:00:00`).toISOString()
                    : null,
                  urgency: values.urgency,
                  notificationPhone:
                    values.notificationPhone || selectedClient?.phone || null,
                  isRework: values.isRework,
                  notes: values.notes || null,
                },
                {
                  onSuccess: (created) => {
                    navigate(`/orders/${created.id}`)
                  },
                },
              ),
            )}
            selectedClient={selectedClient}
          />
        ) : (
          <button className="primary-button" onClick={() => setCreateFormOpen(true)}>
            + Создать заказ
          </button>
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
            queryClient.setQueryData(clientsKey(), (current = []) => {
              if (current.some((row) => row.id === client.id)) return current
              return [client, ...current]
            })
            setOrderFormValue('clientId', client.id)
            if (!orderForm.notificationPhone && client.phone) {
              setOrderFormValue('notificationPhone', client.phone)
            }
          }}
        />
      )}
    </div>
  )
}
