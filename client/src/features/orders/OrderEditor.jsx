import { useState } from 'react'

import { apiError, money, orderStatusLabel } from '../../pages/workspace-utils.js'
import { defectsForNomenclature } from './defect-options.js'
import { ItemStatusActions } from './ItemStatusActions.jsx'
import {
  canIssueWholeOrder,
  remainingOrderItems,
} from './issue-availability.js'
import { NomenclatureCombobox } from './NomenclatureCombobox.jsx'
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
  itemForm,
  setItemForm,
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
    <div className="order-editor">
      <div className="order-summary">
        <div>
          <div className="order-summary-badges">
            <span className="status-pill">{orderStatusLabel(order.status)}</span>
            {order.urgency && order.urgency !== 'normal' && (
              <span className={`status-pill urgency-${order.urgency}`}>
                {urgencyLabels[order.urgency]}
              </span>
            )}
            {order.isRework && (
              <span className="status-pill rework-pill">Повторная обработка</span>
            )}
          </div>
          <h2>{order.displayNumber}</h2>
          <strong className="order-client-name">{order.client?.fullName}</strong>
          <div className="order-operational-meta">
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
          {order.notes && <p className="order-summary-notes">{order.notes}</p>}
          {editable && (
            <button className="text-button" onClick={() => setMetaOpen(true)}>
              Изменить реквизиты заказа
            </button>
          )}
        </div>
        <div className="order-total">
          <span>Итого</span>
          <strong>{money(order.totalAmount)}</strong>
          <small>Оплачено: {money(order.paidAmount)}</small>
          {debt > 0 && <small className="debt-text">Долг: {money(debt)}</small>}
          {!['draft', 'cancelled'].includes(order.status) && (
            <button
              type="button"
              className="primary-button order-payment-button"
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
          className="order-item-form"
          onSubmit={(event) => {
            event.preventDefault()
            addItem.mutate(
              {
                nomenclatureItemId: itemForm.nomenclatureItemId,
                materialId: itemForm.materialId || null,
                colorId: itemForm.colorId || null,
                description: itemForm.description || null,
                quantity: itemForm.quantity || undefined,
                length: itemForm.length || undefined,
                width: itemForm.width || undefined,
                defectIds: itemForm.defectIds,
                contaminationIds: itemForm.contaminationIds,
              },
              {
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
                },
              },
            )
          }}
        >
          <div className="form-grid">
            <NomenclatureCombobox
              ref={itemSelectRef}
              items={nomenclature}
              value={itemForm.nomenclatureItemId}
              onChange={(nomenclatureItemId) =>
                setItemForm((value) => ({
                  ...value,
                  nomenclatureItemId,
                  quantity: '1',
                  length: '',
                  width: '',
                  defectIds: [],
                }))
              }
            />
            <ChoiceChecks
              title="Дефекты при приёмке"
              rows={availableDefects}
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
                <p className="form-hint field-wide">
                  Если размер неизвестен, оставьте оба поля пустыми. Замер можно внести
                  после приёмки.
                </p>
              </>
            )}
            {selectedPosition?.unit === 'linear_meter' && (
              <label className="field-wide">
                Длина, пог. м
                <input
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

      <div className="order-items">
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
                    <span className="measurement-pending">Ожидает замера</span>
                  )}
                </div>
                <div className="order-item-head-actions">
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
              <details
                className="order-item-details"
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
                  {measurementMissing && (
                    <p className="measurement-pending-note">
                      Размер пока неизвестен. Предварительная стоимость позиции —{' '}
                      {money(0)}.
                    </p>
                  )}
                  {canMeasure && <MeasurementEditor item={item} onChanged={onChanged} />}
                  {!!item.defects?.length && (
                    <div className="item-flags">
                      <strong>Дефекты:</strong>{' '}
                      {item.defects.map((row) => row.defect?.name).join(', ')}
                    </div>
                  )}
                  {!!item.contaminations?.length && (
                    <div className="item-flags">
                      <strong>Загрязнения:</strong>{' '}
                      {item.contaminations
                        .map((row) => row.contamination?.name)
                        .join(', ')}
                    </div>
                  )}
                  <div className="service-lines">
                    {(item.services ?? []).map((service) => (
                      <div key={service.id}>
                        <span>
                          <strong>{service.serviceName}</strong>
                          <small>
                            {money(service.unitPrice)} ×{' '}
                            {Number(service.quantity).toLocaleString('ru-RU')}
                          </small>
                        </span>
                        <span className="service-line-actions">
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
        <section className="issue-panel">
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
              if (
                window.confirm(
                  `Выдать весь заказ ${order.displayNumber} — ${remainingItems.length} изд.?`,
                )
              ) {
                issueOrder.mutate({
                  itemIds: remainingItems.map((item) => item.id),
                  reason: issueReason.trim(),
                })
              }
            }}
          >
            Выдать весь заказ
          </button>
          {issueOrder.error && <p className="form-error">{apiError(issueOrder.error)}</p>}
        </section>
      )}
      <div className="order-actions">
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
