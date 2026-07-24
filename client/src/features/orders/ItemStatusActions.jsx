const activeWorkStatuses = new Set([
  'in_progress',
  'cleaning',
  'quality_control',
  'packing',
  'rework',
])

export function ItemStatusActions({
  debtReasonMissing,
  disabled = false,
  item,
  onIssue,
  onSetStatus,
  pendingAction,
}) {
  const locked = ['issued', 'cancelled', 'rejected'].includes(item.status)
  const inWork = activeWorkStatuses.has(item.status)
  const completed = item.status === 'ready'
  const issued = item.status === 'issued'

  return (
    <div className="item-status-control">
      <span>Статус позиции</span>
      <div>
        <button
          type="button"
          className={inWork ? 'active' : ''}
          disabled={disabled || locked || inWork}
          onClick={() => onSetStatus('in_progress')}
        >
          {pendingAction === 'in_progress' ? 'Сохраняем…' : 'В работе'}
        </button>
        <button
          type="button"
          className={completed ? 'active' : ''}
          disabled={disabled || locked || completed}
          onClick={() => onSetStatus('ready')}
        >
          {pendingAction === 'ready' ? 'Сохраняем…' : 'Исполнен'}
        </button>
        <button
          type="button"
          className={issued ? 'active issued' : ''}
          disabled={disabled || issued || !completed || debtReasonMissing}
          title={
            debtReasonMissing
              ? 'Сначала укажите причину выдачи с долгом'
              : !completed && !issued
                ? 'Сначала отметьте изделие исполненным'
                : undefined
          }
          onClick={onIssue}
        >
          {issued ? 'Выдан' : pendingAction === 'issued' ? 'Выдаём…' : 'Выдать изделие'}
        </button>
      </div>
    </div>
  )
}
