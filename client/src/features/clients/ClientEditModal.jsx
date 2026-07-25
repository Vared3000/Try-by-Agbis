import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { apiError } from '../../pages/workspace-utils.js'
import { useUpdateClientWithAddress } from '../../mutations/clients.js'
import { clientEditSchema } from '../../schemas/clients.js'

export function ClientEditModal({ client, onClose }) {
  const primaryAddress =
    client.addresses?.find((address) => address.isPrimary) ?? client.addresses?.[0]
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(clientEditSchema),
    defaultValues: {
      fullName: client.fullName,
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || '',
      address: primaryAddress?.address || '',
    },
  })

  const save = useUpdateClientWithAddress(client.id)

  const submit = handleSubmit((values) => {
    save.mutate(
      { ...values, previousAddress: primaryAddress?.address ?? '' },
      { onSuccess: onClose },
    )
  })

  return (
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
        aria-labelledby="client-edit-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Карточка клиента</p>
            <h2 id="client-edit-title">Редактирование клиента</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <label>
            ФИО или название
            <input autoFocus {...register('fullName')} />
            {errors.fullName && (
              <small className="field-error">{errors.fullName.message}</small>
            )}
          </label>
          <label>
            Телефон
            <input {...register('phone')} placeholder="+7 900 000-00-00" />
          </label>
          <label>
            Email
            <input type="email" {...register('email')} />
            {errors.email && <small className="field-error">{errors.email.message}</small>}
          </label>
          <label>
            Адрес доставки
            <input {...register('address')} placeholder="Город, улица, дом, квартира" />
            {errors.address && (
              <small className="field-error">{errors.address.message}</small>
            )}
            <small>Нужен для доставки и показывается в квитанции.</small>
          </label>
          <label>
            Комментарий
            <textarea rows="3" {...register('notes')} />
          </label>
          {save.error && <p className="form-error">{apiError(save.error)}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-button" disabled={save.isPending || isSubmitting}>
              {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
