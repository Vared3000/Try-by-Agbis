import { useMutation } from '@tanstack/react-query'

import { createOrderPayment, getCurrentCashShift, openCashShift } from '../services/payments.js'
import { findReceptionWorkplace, rublesToKopecks } from '../features/orders/payment-utils.js'

export function useCreatePayment(order, branches) {
  return useMutation({
    mutationFn: async ({ amount, method, debt }) => {
      const amountInKopecks = rublesToKopecks(amount)
      if (BigInt(amountInKopecks) > BigInt(debt)) {
        throw new Error('Сумма оплаты превышает долг по заказу')
      }

      let cashShiftId = null
      if (method === 'cash') {
        const currentShift = await getCurrentCashShift(order.branchId)
        if (currentShift) {
          cashShiftId = currentShift.id
        } else {
          const workplace = findReceptionWorkplace(branches, order)
          if (!workplace) {
            throw new Error('Для наличной оплаты не найдено рабочее место приёмки')
          }
          const openedShift = await openCashShift({
            branchId: order.branchId,
            workplaceId: workplace.id,
            openingAmount: '0',
          })
          cashShiftId = openedShift.id
        }
      }

      return createOrderPayment(order.id, { amount: amountInKopecks, method, cashShiftId })
    },
  })
}
