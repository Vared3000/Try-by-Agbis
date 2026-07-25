import { Controller } from 'react-hook-form'

import styles from './OrderCreatePanel.module.css'

export function OrderCreatePanel({
  control,
  register,
  errors,
  effectiveLocationId,
  effectivePriceListId,
  errorMessage,
  isPending,
  isSubmitting,
  issueLocations,
  locations,
  priceLists,
  onChooseClient,
  onSubmit,
  selectedClient,
  watchedClientId,
}) {
  return (
    <div className={styles.orderCreateCard}>
      <form className="form-grid" onSubmit={onSubmit}>
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
          {errors.clientId && (
            <small className="field-error">{errors.clientId.message}</small>
          )}
        </div>

        {priceLists.length > 0 && (
          <label>
            Прайс-лист
            <Controller
              control={control}
              name="priceListId"
              render={({ field }) => (
                <select
                  value={field.value || effectivePriceListId}
                  onChange={(event) => field.onChange(event.target.value)}
                >
                  {priceLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              )}
            />
          </label>
        )}
        <label>
          Точка приёма
          <Controller
            control={control}
            name="acceptanceLocationId"
            render={({ field }) => (
              <select
                required
                value={field.value || effectiveLocationId}
                onChange={(event) => field.onChange(event.target.value)}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            )}
          />
        </label>
        <label>
          Точка выдачи
          <Controller
            control={control}
            name="issueLocationId"
            render={({ field }) => (
              <select
                required
                value={field.value || effectiveLocationId}
                onChange={(event) => field.onChange(event.target.value)}
              >
                {issueLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            )}
          />
        </label>
        <label>
          Дата приёма
          <input type="date" {...register('acceptedOn')} />
        </label>
        <label>
          Дата выдачи
          <input type="date" {...register('dueAt')} />
          <small>Оставьте пустым — система рассчитает дату автоматически.</small>
        </label>
        <label>
          Телефон для уведомлений
          <input
            type="tel"
            maxLength="32"
            {...register('notificationPhone')}
            placeholder="+7 999 000-00-00"
          />
        </label>
        <label>
          Комментарий
          <input {...register('notes')} />
        </label>
        <label className="order-rework-check">
          <input type="checkbox" {...register('isRework')} />
          <span>
            <strong>Повторная обработка</strong>
            <small>Возврат или доработка ранее принятого изделия</small>
          </span>
        </label>

        {errorMessage && <p className="form-error field-wide">{errorMessage}</p>}
        <button
          className="primary-button field-wide"
          disabled={!watchedClientId || !effectiveLocationId || isPending || isSubmitting}
        >
          {isPending ? 'Создаём черновик…' : 'Создать черновик заказа'}
        </button>
      </form>
    </div>
  )
}
