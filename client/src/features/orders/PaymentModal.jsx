import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../../api/client.js'
import { apiError, money } from '../../pages/workspace-utils.js'
import {
  findReceptionWorkplace,
  kopecksToRubles,
  rublesToKopecks,
} from './payment-utils.js'

const methodLabels = {
  cash: 'наличными',
  card: 'картой',
}

export function PaymentModal({ branches, onClose, onPaid, order }) {
  const debt = Math.max(0, Number(order.totalAmount) - Number(order.paidAmount))
  const [amount, setAmount] = useState(kopecksToRubles(debt))
  const [method, setMethod] = useState('')
  const [localError, setLocalError] = useState('')
  const payment = useMutation({
    mutationFn: async () => {
      const amountInKopecks = rublesToKopecks(amount)
      if (BigInt(amountInKopecks) > BigInt(debt)) {
        throw new Error('Сумма оплаты превышает долг по заказу')
      }

      let cashShiftId = null
      if (method === 'cash') {
        const currentShift = (
          await apiClient.get('/cash-shifts/current', {
            params: { branchId: order.branchId },
          })
        ).data.data
        if (currentShift) {
          cashShiftId = currentShift.id
        } else {
          const workplace = findReceptionWorkplace(branches, order)
          if (!workplace) {
            throw new Error('Для наличной оплаты не найдено рабочее место приёмки')
          }
          const openedShift = (
            await apiClient.post('/cash-shifts', {
              branchId: order.branchId,
              workplaceId: workplace.id,
              openingAmount: '0',
            })
          ).data.data
          cashShiftId = openedShift.id
        }
      }

      return (
        await apiClient.post(
          `/orders/${order.id}/payments`,
          {
            amount: amountInKopecks,
            method,
            cashShiftId,
          },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } },
        )
      ).data.data
    },
    onSuccess: async () => {
      await onPaid()
      onClose()
    },
    onError: (error) => {
      setLocalError(error.response ? apiError(error) : error.message)
    },
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
        className="modal-card payment-modal"
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

        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            setLocalError('')
            payment.mutate()
          }}
        >
          <div className="payment-summary">
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
              <input
                required
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span>₽</span>
            </div>
          </label>

          <fieldset className="payment-methods">
            <legend>Способ оплаты</legend>
            <button
              type="button"
              className={method === 'cash' ? 'active' : ''}
              onClick={() => setMethod('cash')}
            >
              <span aria-hidden="true">₽</span>
              <strong>Наличные</strong>
            </button>
            <button
              type="button"
              className={method === 'card' ? 'active' : ''}
              onClick={() => setMethod('card')}
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
              disabled={!method || payment.isPending || debt <= 0}
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
