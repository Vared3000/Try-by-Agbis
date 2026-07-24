export function OrderCreatePanel({
  branches,
  effectiveBranchId,
  effectiveLocationId,
  errorMessage,
  form,
  isPending,
  issueLocations,
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
          Точка выдачи
          <select
            required
            value={form.issueLocationId || effectiveLocationId}
            onChange={(event) => onFormChange({ issueLocationId: event.target.value })}
          >
            {issueLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.branchName} · {location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата приёма
          <input disabled type="text" value={new Date().toLocaleDateString('ru-RU')} />
        </label>
        <label>
          Срок готовности
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => onFormChange({ dueAt: event.target.value })}
          />
          <small>Оставьте пустым — система рассчитает дату автоматически.</small>
        </label>
        <label>
          Срочность
          <select
            value={form.urgency}
            onChange={(event) => onFormChange({ urgency: event.target.value })}
          >
            <option value="normal">Обычный заказ</option>
            <option value="urgent">Срочный</option>
            <option value="express">Экспресс</option>
          </select>
        </label>
        <label>
          Телефон для уведомлений
          <input
            type="tel"
            maxLength="32"
            value={form.notificationPhone}
            onChange={(event) => onFormChange({ notificationPhone: event.target.value })}
            placeholder="+7 999 000-00-00"
          />
        </label>
        <label>
          Комментарий
          <input
            value={form.notes}
            onChange={(event) => onFormChange({ notes: event.target.value })}
          />
        </label>
        <label className="order-rework-check">
          <input
            type="checkbox"
            checked={form.isRework}
            onChange={(event) => onFormChange({ isRework: event.target.checked })}
          />
          <span>
            <strong>Повторная обработка</strong>
            <small>Возврат или доработка ранее принятого изделия</small>
          </span>
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
