import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { apiError, money } from '../../pages/workspace-utils.js'
import { useCreatePayment } from '../../mutations/payments.js'
import { kopecksToRubles } from './payment-utils.js'
import styles from './PaymentModal.module.css'

const methodLabels = {
  cash: 'наличными',
  card: 'картой',
}

const paymentSchema = z.object({
  amount: z.string().trim().min(1, 'Введите сумму'),
  method: z.enum(['cash', 'card'], { message: 'Выберите способ оплаты' }),
})

export function PaymentModal({ branches, onClose, onPaid, order }) {
  const debt = Math.max(0, Number(order.totalAmount) - Number(order.paidAmount))
  const [localError, setLocalError] = useState('')
  const payment = useCreatePayment(order, branches)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: kopecksToRubles(debt), method: '' },
  })
  const method = useWatch({ control, name: 'method' })

  const submit = handleSubmit((values) => {
    setLocalError('')
    payment.mutate(
      { amount: values.amount, method: values.method, debt },
      {
        onSuccess: async () => {
          await onPaid()
          onClose()
        },
        onError: (error) => {
          setLocalError(error.response ? apiError(error) : error.message)
        },
      },
    )
  })

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !payment.isPending) onClose()
      }}
    >
      <section
        className={`modal-card ${styles.paymentModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Заказ {order.displayNumber}</p>
            <h2 id="payment-title">Оплата</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            disabled={payment.isPending}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <div className={styles.paymentSummary}>
            <span>Стоимость заказа</span>
            <strong>{money(order.totalAmount)}</strong>
            <span>Уже оплачено</span>
            <strong>{money(order.paidAmount)}</strong>
            <span>Осталось оплатить</span>
            <strong>{money(debt)}</strong>
          </div>

          <label>
            Сумма оплаты
            <div className="input-suffix">
              <input autoFocus inputMode="decimal" {...register('amount')} />
              <span>₽</span>
            </div>
            {errors.amount && (
              <small className="field-error">{errors.amount.message}</small>
            )}
          </label>

          <fieldset className={styles.paymentMethods}>
            <legend>Способ оплаты</legend>
            <button
              type="button"
              className={method === 'cash' ? 'active' : ''}
              onClick={() => setValue('method', 'cash', { shouldValidate: true })}
            >
              <span aria-hidden="true">₽</span>
              <strong>Наличные</strong>
            </button>
            <button
              type="button"
              className={method === 'card' ? 'active' : ''}
              onClick={() => setValue('method', 'card', { shouldValidate: true })}
            >
              <span aria-hidden="true">▣</span>
              <strong>Картой</strong>
            </button>
          </fieldset>

          {(localError || payment.error) && (
            <p className="form-error">{localError || apiError(payment.error)}</p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={payment.isPending}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              className="primary-button"
              disabled={!method || payment.isPending || isSubmitting || debt <= 0}
            >
              {payment.isPending
                ? 'Проводим оплату…'
                : method
                  ? `Оплатить ${methodLabels[method]}`
                  : 'Выберите способ оплаты'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
