import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { ClientPickerModal } from '../../pages/ClientPickerModal.jsx'
import { apiError, isClientFacingLocation } from '../../pages/workspace-utils.js'
import { orderMetaSchema } from '../../schemas/orders.js'

export function OrderMetaEditor({ branches, order, priceLists, updateOrder, onClose }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [displayClient, setDisplayClient] = useState(order.client)
  const issueLocations = branches.flatMap((branch) =>
    (branch.locations ?? [])
      .filter(isClientFacingLocation)
      .map((location) => ({
        ...location,
        branchName: branch.name,
      })),
  )
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(orderMetaSchema),
    defaultValues: {
      clientId: order.clientId,
      issueLocationId:
        order.issueLocationId || order.acceptanceLocationId || issueLocations[0]?.id || '',
      priceListId: order.priceListId || priceLists[0]?.id || '',
      dueAt: order.dueAt ? new Date(order.dueAt).toLocaleDateString('sv-SE') : '',
      urgency: order.urgency || 'normal',
      notificationPhone: order.notificationPhone || order.client?.phone || '',
      isRework: Boolean(order.isRework),
      notes: order.notes || '',
    },
  })

  const submit = handleSubmit((values) => {
    updateOrder.mutate(
      {
        clientId: values.clientId,
        issueLocationId: values.issueLocationId,
        priceListId: values.priceListId || null,
        dueAt: values.dueAt ? new Date(`${values.dueAt}T18:00:00`).toISOString() : null,
        urgency: values.urgency,
        notificationPhone: values.notificationPhone || null,
        isRework: values.isRework,
        notes: values.notes || null,
      },
      { onSuccess: onClose },
    )
  })

  return (
    <>
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <section
          className="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-meta-title"
        >
          <div className="modal-head">
            <div>
              <p className="eyebrow">Черновик {order.displayNumber}</p>
              <h2 id="order-meta-title">Реквизиты заказа</h2>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <form className="modal-form" onSubmit={submit}>
            <div className="client-selection">
              <div>
                <span className="avatar">
                  {displayClient?.fullName?.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <small>Клиент заказа</small>
                  <strong>{displayClient?.fullName}</strong>
                  <em>{displayClient?.phone || 'Телефон не указан'}</em>
                </span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPickerOpen(true)}
              >
                Сменить клиента
              </button>
              {errors.clientId && (
                <small className="field-error">{errors.clientId.message}</small>
              )}
            </div>
            <div className="form-grid">
              <label>
                Точка выдачи
                <select required {...register('issueLocationId')}>
                  {issueLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.branchName} · {location.name}
                    </option>
                  ))}
                </select>
              </label>
              {priceLists.length > 0 && (
                <label>
                  Прайс-лист
                  <select {...register('priceListId')}>
                    {priceLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                  <small>Действует для изделий, добавленных после сохранения.</small>
                </label>
              )}
              <label>
                Срок готовности
                <input type="date" {...register('dueAt')} />
                <small>
                  {order.dueDateMode === 'manual'
                    ? 'Дата была установлена вручную.'
                    : 'Дата рассчитана автоматически по нормативу изделия.'}
                </small>
              </label>
              <label>
                Срочность
                <select {...register('urgency')}>
                  <option value="normal">Обычный заказ</option>
                  <option value="urgent">Срочный</option>
                  <option value="express">Экспресс</option>
                </select>
              </label>
              <label>
                Телефон для уведомлений
                <input type="tel" maxLength="32" {...register('notificationPhone')} />
              </label>
            </div>
            <label className="order-rework-check">
              <input type="checkbox" {...register('isRework')} />
              <span>
                <strong>Повторная обработка</strong>
                <small>Возврат или доработка ранее принятого изделия</small>
              </span>
            </label>
            {order.dueDateMode === 'manual' && (
              <button
                type="button"
                className="text-button"
                onClick={() => setValue('dueAt', '')}
              >
                Вернуть автоматический расчёт срока
              </button>
            )}
            <label>
              Комментарий
              <textarea rows="4" maxLength="5000" {...register('notes')} />
            </label>
            {updateOrder.error && (
              <p className="form-error">{apiError(updateOrder.error)}</p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Отмена
              </button>
              <button className="primary-button" disabled={updateOrder.isPending || isSubmitting}>
                Сохранить изменения
              </button>
            </div>
          </form>
        </section>
      </div>
      {pickerOpen && (
        <ClientPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(client) => {
            setValue('clientId', client.id)
            setDisplayClient(client)
          }}
        />
      )}
    </>
  )
}
