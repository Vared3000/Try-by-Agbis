export function OrderCreatePanel({
  effectiveLocationId,
  effectivePriceListId,
  errorMessage,
  form,
  isPending,
  issueLocations,
  locations,
  priceLists,
  today,
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

        {priceLists.length > 0 && (
          <label>
            Прайс-лист
            <select
              value={effectivePriceListId}
              onChange={(event) => onFormChange({ priceListId: event.target.value })}
            >
              {priceLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Точка приёма
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
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата приёма
          <input
            type="date"
            max={today}
            value={form.acceptedOn || today}
            onChange={(event) => onFormChange({ acceptedOn: event.target.value })}
          />
        </label>
        <label>
          Дата выдачи
          <input
            type="date"
            value={form.dueAt}
            onChange={(event) => onFormChange({ dueAt: event.target.value })}
          />
          <small>Оставьте пустым — система рассчитает дату автоматически.</small>
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
