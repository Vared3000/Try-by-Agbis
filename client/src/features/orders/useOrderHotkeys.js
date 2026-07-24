import { useEffect } from 'react'

export function useOrderHotkeys({
  onNewOrder,
  onAddItem,
  onAcceptOrder,
  onPrintReceipt,
  canAddItem,
  canAcceptOrder,
  canPrintReceipt,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || document.querySelector('[aria-modal="true"]')) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        onNewOrder()
        return
      }
      if (event.key === 'F4' && canAddItem) {
        event.preventDefault()
        onAddItem()
        return
      }
      if (event.key === 'F8' && canPrintReceipt) {
        event.preventDefault()
        onPrintReceipt()
        return
      }
      if (event.key === 'Enter' && event.ctrlKey && canAcceptOrder) {
        event.preventDefault()
        onAcceptOrder()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    canAcceptOrder,
    canAddItem,
    canPrintReceipt,
    onAcceptOrder,
    onAddItem,
    onNewOrder,
    onPrintReceipt,
  ])
}
