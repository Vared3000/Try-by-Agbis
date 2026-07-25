import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { ConfirmDialog } from '../../components/ConfirmDialog.jsx'
import { apiError, money, orderStatusLabel } from '../../pages/workspace-utils.js'
import { orderItemSchema } from '../../schemas/order-items.js'
import { defectsForNomenclature } from './defect-options.js'
import { ItemStatusActions } from './ItemStatusActions.jsx'
import {
  canIssueWholeOrder,
  remainingOrderItems,
} from './issue-availability.js'
import { NomenclatureCombobox } from './NomenclatureCombobox.jsx'
import styles from './OrderEditor.module.css'
import { OrderMetaEditor } from './OrderMetaEditor.jsx'
import {
  ChoiceChecks,
  ItemPhotos,
  MeasurementEditor,
  RemoveServiceButton,
  ServiceAdder,
} from './OrderItemControls.jsx'
import { PaymentModal } from './PaymentModal.jsx'
import { SaveOrderButton } from './SaveOrderButton.jsx'

const findName = (rows, id) => rows?.find((row) => row.id === id)?.name
const urgencyLabels = {
  normal: 'Обычный',
  urgent: 'Срочный',
  express: 'Экспресс',
}

export function OrderEditor({
  order,
  loading,
  branches,
  garments,
  nomenclature,
  materials,
  colors,
  defects,
  contaminations,
  prices,
  priceLists,
  itemSelectRef,
  addItem,
  updateOrder,
  removeItem,
  acceptOrder,
  cancelOrder,
  issueOrder,
  updateItemWorkStatus,
  onOpenDocument,
  actionError,
  onChanged,
}) {
  const [issueReason, setIssueReason] = useState('')
  const [metaOpen, setMetaOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const closeConfirmDialog = () => setConfirmDialog(null)
  const {
    register: registerItem,
    handleSubmit: handleItemSubmit,
    reset: resetItemForm,
    setValue: setItemFormValue,
    control: itemFormControl,
  } = useForm({
    resolver: zodResolver(orderItemSchema),
    defaultValues: {
      nomenclatureItemId: '',
      materialId: '',
      colorId: '',
      description: '',
      quantity: '1',
      length: '',
      width: '',
      defectIds: [],
      contaminationIds: [],
    },
  })
  const itemForm = useWatch({ control: itemFormControl })
  if (loading || !order) return <div className="empty-state compact">Загружаем…</div>
  const editable = order.status === 'draft'
  const readyItems = order.items?.filter((item) => item.status === 'ready') ?? []
  const remainingItems = remainingOrderItems(order.items)
  const issueActionsAvailable = !['draft', 'cancelled', 'issued'].includes(order.status)
  const allRemainingReady = canIssueWholeOrder(order.items)
  const issuingItemIds = issueOrder.isPending ? (issueOrder.variables?.itemIds ?? []) : []
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
  const measurementComplete =
    selectedPosition?.unit === 'square_meter'
      ? Boolean(itemForm.length && itemForm.width)
      : selectedPosition?.unit === 'linear_meter'
        ? Boolean(itemForm.length)
        : true
  const availableDefects = defectsForNomenclature(selectedPosition, defects)

  return (
    <div className={styles.orderEditor}>
      <div className={styles.orderSummary}>
        <div>
          <div className={styles.orderSummaryBadges}>
            <span className="status-pill">{orderStatusLabel(order.status)}</span>
            {order.urgency && order.urgency !== 'normal' && (
              <span
                className={`status-pill ${order.urgency === 'urgent' ? styles.urgencyUrgent : styles.urgencyExpress}`}
              >
                {urgencyLabels[order.urgency]}
              </span>
            )}
            {order.isRework && (
              <span className={`status-pill ${styles.reworkPill}`}>
                Повторная обработка
              </span>
            )}
          </div>
          <h2>{order.displayNumber}</h2>
          <strong className={styles.orderClientName}>{order.client?.fullName}</strong>
          <div className={styles.orderOperationalMeta}>
            <OrderMetaValue
              label="Принят"
              value={`${
                order.acceptedOn
                  ? order.acceptedOn.split('-').reverse().join('.')
                  : new Date(order.createdAt).toLocaleDateString('ru-RU')
              } · ${
                order.acceptanceLocation?.name || order.branch?.name || 'Точка не указана'
              }`}
            />
            <OrderMetaValue
              label={
                order.dueDateMode === 'manual'
                  ? 'Выдать · дата вручную'
                  : 'Выдать · рассчитано'
              }
              value={
                order.dueAt
                  ? `${new Date(order.dueAt).toLocaleDateString('ru-RU')} · ${
                      order.issueLocation?.name || 'Точка не указана'
                    }`
                  : `Срок не назначен · ${
                      order.issueLocation?.name || 'Точка не указана'
                    }`
              }
            />
            <OrderMetaValue
              label="Уведомления"
              value={order.notificationPhone || 'Телефон не указан'}
            />
            <OrderMetaValue
              label="Приёмщик"
              value={order.createdBy?.displayName || 'Не указан'}
            />
          </div>
          {order.notes && <p className={styles.orderSummaryNotes}>{order.notes}</p>}
          {editable && (
            <button className="text-button" onClick={() => setMetaOpen(true)}>
              Изменить реквизиты заказа
            </button>
          )}
        </div>
        <div className={styles.orderTotal}>
          <span>Итого</span>
          <strong>{money(order.totalAmount)}</strong>
          <small>Оплачено: {money(order.paidAmount)}</small>
          {debt > 0 && <small className={styles.debtText}>Долг: {money(debt)}</small>}
          {!['draft', 'cancelled'].includes(order.status) && (
            <button
              type="button"
              className={`primary-button ${styles.orderPaymentButton}`}
              disabled={debt <= 0}
              onClick={() => setPaymentOpen(true)}
            >
              {debt > 0 ? 'Оплата' : 'Оплачено'}
            </button>
          )}
        </div>
      </div>

      {editable && (
        <form
          className={styles.orderItemForm}
          onSubmit={handleItemSubmit((values) => {
            addItem.mutate(
              {
                nomenclatureItemId: values.nomenclatureItemId,
                materialId: values.materialId || null,
                colorId: values.colorId || null,
                description: values.description || null,
                quantity: values.quantity || undefined,
                length: values.length || undefined,
                width: values.width || undefined,
                defectIds: values.defectIds,
                contaminationIds: values.contaminationIds,
              },
              {
                onSuccess: () => {
                  resetItemForm({
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
                },
              },
            )
          })}
        >
          <div className="form-grid">
            <Controller
              control={itemFormControl}
              name="nomenclatureItemId"
              render={({ field }) => (
                <NomenclatureCombobox
                  ref={itemSelectRef}
                  items={nomenclature}
                  value={field.value}
                  onChange={(nomenclatureItemId) => {
                    field.onChange(nomenclatureItemId)
                    setItemFormValue('quantity', '1')
                    setItemFormValue('length', '')
                    setItemFormValue('width', '')
                    setItemFormValue('defectIds', [])
                  }}
                />
              )}
            />
            <Controller
              control={itemFormControl}
              name="defectIds"
              render={({ field }) => (
                <ChoiceChecks
                  title="Дефекты при приёмке"
                  rows={availableDefects}
                  selected={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={itemFormControl}
              name="contaminationIds"
              render={({ field }) => (
                <ChoiceChecks
                  title="Загрязнения"
                  rows={contaminations}
                  selected={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {selectedPosition?.unit === 'square_meter' && (
              <>
                <label>
                  Длина, м
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    {...registerItem('length')}
                  />
                </label>
                <label>
                  Ширина, м
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    {...registerItem('width')}
                  />
                </label>
                <p className="form-hint field-wide">
                  Если размер неизвестен, оставьте оба поля пустыми. Замер можно внести
                  после приёмки.
                </p>
              </>
            )}
            {selectedPosition?.unit === 'linear_meter' && (
              <label className="field-wide">
                Длина, пог. м
                <input type="number" min="0.001" step="0.001" {...registerItem('length')} />
                <small>
                  Можно оставить пустым и указать длину после фактического замера.
                </small>
              </label>
            )}
            {selectedPosition &&
              ['piece', 'kilogram'].includes(selectedPosition.unit) && (
                <label className="field-wide">
                  {selectedPosition.unit === 'kilogram' ? 'Вес, кг' : 'Количество, шт.'}
                  <input
                    required
                    type="number"
                    min={selectedPosition.unit === 'piece' ? '1' : '0.001'}
                    step={selectedPosition.unit === 'piece' ? '1' : '0.001'}
                    {...registerItem('quantity')}
                  />
                </label>
              )}
            <label>
              Материал
              <select {...registerItem('materialId')}>
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
              <select {...registerItem('colorId')}>
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
                {...registerItem('description')}
                placeholder="Марка, повреждения, комментарий"
              />
            </label>
          </div>
          {selectedPosition && (
            <div className={styles.itemCalculation}>
              <span>
                {selectedPosition.unit === 'square_meter'
                  ? measurementComplete
                    ? `Площадь: ${calculatedQuantity.toLocaleString('ru-RU')} м²`
                    : 'Площадь: ожидает замера'
                  : selectedPosition.unit === 'linear_meter' && !measurementComplete
                    ? 'Длина: ожидает замера'
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
          <button
            className="primary-button"
            disabled={!itemForm.nomenclatureItemId || addItem.isPending}
          >
            Добавить позицию в заказ <kbd>F4</kbd>
          </button>
          {addItem.error && <p className="form-error">{apiError(addItem.error)}</p>}
        </form>
      )}

      <div className={styles.orderItems}>
        {(order.items ?? []).map((item, index) => {
          const measurementUnit = ['square_meter', 'linear_meter'].includes(
            item.nomenclature?.unit,
          )
          const measurementMissing =
            measurementUnit &&
            (item.nomenclature.unit === 'square_meter' ? !item.area : !item.quantity)
          const canMeasure =
            measurementUnit &&
            !['issued', 'cancelled'].includes(order.status) &&
            !['issued', 'cancelled'].includes(item.status)

          return (
            <article key={item.id} className={styles.orderItemCard}>
              <div className={styles.orderItemHead}>
                <div>
                  <span>Изделие {index + 1}</span>
                  <strong>
                    {item.nomenclature?.name ||
                      findName(garments, item.garmentTypeId) ||
                      'Изделие'}
                  </strong>
                  <small>
                    {[
                      findName(materials, item.materialId),
                      findName(colors, item.colorId),
                    ]
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
                  {measurementMissing && (
                    <span className={styles.measurementPending}>Ожидает замера</span>
                  )}
                </div>
                <div className={styles.orderItemHeadActions}>
                  <strong>{money(item.totalAmount)}</strong>
                  {!['draft', 'cancelled'].includes(order.status) && (
                    <>
                      <ItemStatusActions
                        debtReasonMissing={debt > 0 && !issueReason.trim()}
                        disabled={issueOrder.isPending || updateItemWorkStatus.isPending}
                        item={item}
                        pendingAction={
                          updateItemWorkStatus.isPending &&
                          updateItemWorkStatus.variables?.itemId === item.id
                            ? updateItemWorkStatus.variables.status
                            : issuingItemIds.includes(item.id)
                              ? 'issued'
                              : ''
                        }
                        onSetStatus={(status) =>
                          updateItemWorkStatus.mutate({ itemId: item.id, status })
                        }
                        onIssue={() =>
                          issueOrder.mutate({
                            itemIds: [item.id],
                            reason: issueReason.trim(),
                          })
                        }
                      />
                      {updateItemWorkStatus.error &&
                        updateItemWorkStatus.variables?.itemId === item.id && (
                          <small className="item-status-error">
                            {apiError(updateItemWorkStatus.error)}
                          </small>
                        )}
                    </>
                  )}
                </div>
              </div>
              <details className={styles.orderItemDetails}>
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
                <div className={styles.orderItemDetailsContent}>
                  {item.description && <p>{item.description}</p>}
                  {item.nomenclature && (
                    <div className={styles.itemMeasurements}>
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
                  {measurementMissing && (
                    <p className={styles.measurementPendingNote}>
                      Размер пока неизвестен. Предварительная стоимость позиции —{' '}
                      {money(0)}.
                    </p>
                  )}
                  {canMeasure && <MeasurementEditor item={item} onChanged={onChanged} />}
                  {!!item.defects?.length && (
                    <div className={styles.itemFlags}>
                      <strong>Дефекты:</strong>{' '}
                      {item.defects.map((row) => row.defect?.name).join(', ')}
                    </div>
                  )}
                  {!!item.contaminations?.length && (
                    <div className={styles.itemFlags}>
                      <strong>Загрязнения:</strong>{' '}
                      {item.contaminations
                        .map((row) => row.contamination?.name)
                        .join(', ')}
                    </div>
                  )}
                  <div className={styles.serviceLines}>
                    {(item.services ?? []).map((service) => (
                      <div key={service.id}>
                        <span>
                          <strong>{service.serviceName}</strong>
                          <small>
                            {money(service.unitPrice)} ×{' '}
                            {Number(service.quantity).toLocaleString('ru-RU')}
                          </small>
                        </span>
                        <span className={styles.serviceLineActions}>
                          <strong>{money(service.totalPrice)}</strong>
                          {editable && (
                            <RemoveServiceButton
                              itemId={item.id}
                              service={service}
                              onChanged={onChanged}
                            />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <ItemPhotos item={item} editable={editable} onChanged={onChanged} />
                  {editable && (
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
          )
        })}
      </div>

      {!order.items?.length && (
        <div className="empty-state compact">Добавьте первую позицию из номенклатуры</div>
      )}
      {actionError && <p className="form-error">{actionError}</p>}
      {issueActionsAvailable && !!remainingItems.length && (
        <section className={styles.issuePanel}>
          <div>
            <p className="eyebrow">Выдача</p>
            <h3>
              Готово {readyItems.length} из {remainingItems.length} изделий
            </h3>
            {!allRemainingReady && (
              <small>
                Выдать весь заказ можно, когда будут готовы все оставшиеся изделия.
              </small>
            )}
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
              !allRemainingReady ||
              (debt > 0 && !issueReason.trim()) ||
              issueOrder.isPending
            }
            onClick={() => {
              setConfirmDialog({
                title: 'Выдать весь заказ?',
                message: `Выдать весь заказ ${order.displayNumber} — ${remainingItems.length} изд.?`,
                confirmLabel: 'Выдать',
                onConfirm: () => {
                  closeConfirmDialog()
                  issueOrder.mutate({
                    itemIds: remainingItems.map((item) => item.id),
                    reason: issueReason.trim(),
                  })
                },
              })
            }}
          >
            Выдать весь заказ
          </button>
          {issueOrder.error && <p className="form-error">{apiError(issueOrder.error)}</p>}
        </section>
      )}
      <div className={styles.orderActions}>
        <SaveOrderButton
          changeToken={order.version}
          disabled={
            addItem.isPending ||
            updateOrder.isPending ||
            removeItem.isPending ||
            acceptOrder.isPending ||
            cancelOrder.isPending ||
            updateItemWorkStatus.isPending
          }
          onSave={onChanged}
          primary={!editable}
        />
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
          className="secondary-button"
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
              setConfirmDialog({
                title: 'Отменить заказ?',
                message: `Отменить заказ ${order.displayNumber}? Действие нельзя будет отменить.`,
                confirmLabel: 'Отменить заказ',
                danger: true,
                onConfirm: () => {
                  closeConfirmDialog()
                  cancelOrder.mutate()
                },
              })
            }}
          >
            Отменить заказ
          </button>
        )}
        {acceptOrder.error && <p className="form-error">{apiError(acceptOrder.error)}</p>}
      </div>
      {metaOpen && (
        <OrderMetaEditor
          branches={branches}
          order={order}
          priceLists={priceLists}
          updateOrder={updateOrder}
          onClose={() => setMetaOpen(false)}
        />
      )}
      {paymentOpen && (
        <PaymentModal
          branches={branches}
          order={order}
          onClose={() => setPaymentOpen(false)}
          onPaid={onChanged}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        danger={confirmDialog?.danger}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={closeConfirmDialog}
      />
    </div>
  )
}

function OrderMetaValue({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
