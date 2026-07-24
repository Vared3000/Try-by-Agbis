import { useState } from 'react'

export function SaveOrderButton({
  changeToken,
  disabled = false,
  onSave,
  primary = true,
}) {
  const [saveState, setSaveState] = useState({
    changeToken,
    status: 'idle',
  })
  const status = saveState.changeToken === changeToken ? saveState.status : 'idle'

  const save = async () => {
    setSaveState({ changeToken, status: 'saving' })
    try {
      await onSave()
      setSaveState({ changeToken, status: 'saved' })
    } catch {
      setSaveState({ changeToken, status: 'idle' })
    }
  }

  return (
    <button
      type="button"
      className={`${primary ? 'primary-button' : 'secondary-button'} save-order-button`}
      disabled={disabled || status === 'saving'}
      onClick={save}
    >
      {status === 'saving'
        ? 'Сохраняем…'
        : status === 'saved'
          ? 'Заказ сохранён ✓'
          : 'Сохранить заказ'}
    </button>
  )
}
