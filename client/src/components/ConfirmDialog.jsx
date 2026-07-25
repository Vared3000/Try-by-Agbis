export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="modal-card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="modal-head">
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'secondary-button danger-button' : 'primary-button'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
