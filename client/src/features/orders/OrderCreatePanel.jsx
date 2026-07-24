export function OrderCreatePanel({
  branches,
  effectiveBranchId,
  effectiveLocationId,
  errorMessage,
  form,
  isPending,
  locations,
  onChooseClient,
  onFormChange,
  onSubmit,
  selectedClient,
}) {
  return (
    <div className="order-create-card">
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="client-selection field-wide">
          {selectedClient ? (
            <div>
              <span className="avatar">
                {selectedClient.fullName.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <small>Клиент заказа</small>
                <strong>{selectedClient.fullName}</strong>
                <em>
                  {selectedClient.phone || selectedClient.email || 'Контакты не указаны'}
                </em>
              </span>
            </div>
          ) : (
            <div>
              <span className="client-placeholder">◎</span>
              <span>
                <small>Клиент не выбран</small>
                <strong>Найдите или создайте клиента</strong>
              </span>
            </div>
          )}
          <button type="button" className="secondary-button" onClick={onChooseClient}>
            {selectedClient ? 'Сменить клиента' : 'Выбрать клиента'}
          </button>
        </div>

        <label>
          Филиал
          <select
            required
            value={effectiveBranchId}
            onChange={(event) =>
              onFormChange({
                branchId: event.target.value,
                acceptanceLocationId: '',
              })
            }
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Точка приёмки
          <select
            required
            value={effectiveLocationId}
            onChange={(event) =>
              onFormChange({ acceptanceLocationId: event.target.value })
            }
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Срок готовности
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => onFormChange({ dueAt: event.target.value })}
          />
        </label>
        <label>
          Комментарий
          <input
            value={form.notes}
            onChange={(event) => onFormChange({ notes: event.target.value })}
          />
        </label>

        {errorMessage && <p className="form-error field-wide">{errorMessage}</p>}
        <button
          className="primary-button field-wide"
          disabled={!form.clientId || !effectiveLocationId || isPending}
        >
          {isPending ? 'Создаём черновик…' : 'Создать черновик заказа'}
        </button>
      </form>
    </div>
  )
}
