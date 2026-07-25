import { useEffect, useState } from 'react'

import { apiError } from '../../pages/workspace-utils.js'
import { useDeleteFile, useUploadFile } from '../../mutations/files.js'
import { useUpdateOrderItemMeasurements } from '../../mutations/measurements.js'
import { useAddOrderItemService, useRemoveOrderItemService } from '../../mutations/orders.js'
import { getFileBlob } from '../../services/files.js'
import { availableServicePrices } from './service-options.js'
import { ServiceCombobox } from './ServiceCombobox.jsx'

export function ItemPhotos({ item, editable, onChanged }) {
  const upload = useUploadFile(item.id, { onSuccess: onChanged })
  const remove = useDeleteFile({ onSuccess: onChanged })

  return (
    <div className="item-photos">
      <div className="item-photos-head">
        <strong>Фотографии</strong>
        <span>{item.files?.length ?? 0}</span>
      </div>
      <div className="photo-grid">
        {(item.files ?? []).map((file) => (
          <div key={file.id} className="photo-card">
            <ProtectedImage file={file} />
            <small title={file.originalName}>{file.originalName}</small>
            {editable && (
              <button
                className="text-button danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(file.id)}
              >
                Удалить
              </button>
            )}
          </div>
        ))}
        {editable && (
          <label className="photo-upload">
            <span>＋</span>
            Добавить фото
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload.mutate(file)
                event.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      {upload.error && <p className="form-error">{apiError(upload.error)}</p>}
      {remove.error && <p className="form-error">{apiError(remove.error)}</p>}
    </div>
  )
}

function ProtectedImage({ file }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    getFileBlob(file.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setSource(objectUrl)
      })
      .catch(() => {})
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id])

  return source ? (
    <img src={source} alt={file.originalName} loading="lazy" />
  ) : (
    <span className="photo-loading">Фото</span>
  )
}

export function ChoiceChecks({ title, rows, selected, onChange }) {
  return (
    <fieldset className="choice-checks">
      <legend>{title}</legend>
      <div>
        {rows.map((row) => (
          <label key={row.id}>
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={() =>
                onChange(
                  selected.includes(row.id)
                    ? selected.filter((id) => id !== row.id)
                    : [...selected, row.id],
                )
              }
            />
            {row.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function MeasurementEditor({ item, onChanged }) {
  const isSquareMeter = item.nomenclature?.unit === 'square_meter'
  const measured = isSquareMeter ? Boolean(item.area) : Boolean(item.quantity)
  const [editing, setEditing] = useState(!measured)
  const [length, setLength] = useState(item.length ?? '')
  const [width, setWidth] = useState(item.width ?? '')
  const saveMeasurement = useUpdateOrderItemMeasurements(item.id, {
    onSuccess: () => {
      setEditing(false)
      onChanged()
    },
  })

  if (!editing) {
    return (
      <button
        type="button"
        className="text-button measurement-edit-button"
        onClick={() => setEditing(true)}
      >
        Изменить замер
      </button>
    )
  }

  return (
    <form
      className="measurement-editor"
      onSubmit={(event) => {
        event.preventDefault()
        saveMeasurement.mutate({
          length,
          width: isSquareMeter ? width : undefined,
        })
      }}
    >
      <div>
        <strong>{measured ? 'Корректировка замера' : 'Внести замер'}</strong>
        <small>Стоимость пересчитается автоматически по цене заказа.</small>
      </div>
      <label>
        Длина, м
        <input
          required
          type="number"
          min="0.001"
          step="0.001"
          value={length}
          onChange={(event) => setLength(event.target.value)}
        />
      </label>
      {isSquareMeter && (
        <label>
          Ширина, м
          <input
            required
            type="number"
            min="0.001"
            step="0.001"
            value={width}
            onChange={(event) => setWidth(event.target.value)}
          />
        </label>
      )}
      <div className="measurement-actions">
        {measured && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setLength(item.length ?? '')
              setWidth(item.width ?? '')
              setEditing(false)
            }}
          >
            Отмена
          </button>
        )}
        <button className="primary-button" disabled={saveMeasurement.isPending}>
          {saveMeasurement.isPending ? 'Сохраняем…' : 'Сохранить замер'}
        </button>
      </div>
      {saveMeasurement.error && (
        <p className="form-error">{apiError(saveMeasurement.error)}</p>
      )}
    </form>
  )
}

export function ServiceAdder({ item, prices, onChanged }) {
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const options = availableServicePrices(item, prices)
  const services = options.map((price) => ({
    ...price.service,
    price: price.price,
  }))
  const addService = useAddOrderItemService(item.id, {
    onSuccess: () => {
      setServiceId('')
      setQuantity('1')
      onChanged()
    },
  })

  return (
    <form
      className="service-adder"
      onSubmit={(event) => {
        event.preventDefault()
        addService.mutate({ serviceId, quantity })
      }}
    >
      <div className="service-adder-heading field-wide">
        <strong>Добавить услугу</strong>
        <small>Например, пятновыведение, пропитку или мелкий ремонт.</small>
      </div>
      <ServiceCombobox
        items={services}
        label="Дополнительная услуга"
        value={serviceId}
        onChange={setServiceId}
      />
      <label>
        Количество
        <input
          required
          min="0.001"
          step="0.001"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>
      <button className="secondary-button" disabled={!serviceId || addService.isPending}>
        {addService.isPending ? 'Добавляем…' : 'Добавить услугу'}
      </button>
      {!options.length && (
        <small className="form-hint field-wide">
          Нет доступных дополнительных услуг. Добавьте услуги и цены в активный
          прайс-лист.
        </small>
      )}
      {addService.error && <p className="form-error">{apiError(addService.error)}</p>}
    </form>
  )
}

export function RemoveServiceButton({ itemId, service, onChanged }) {
  const removeService = useRemoveOrderItemService(itemId, service.id, {
    onSuccess: onChanged,
  })

  return (
    <>
      <button
        type="button"
        className="text-button danger"
        disabled={removeService.isPending}
        onClick={() => removeService.mutate()}
        aria-label={`Удалить услугу ${service.serviceName}`}
      >
        Удалить
      </button>
      {removeService.error && (
        <small className="item-status-error">{apiError(removeService.error)}</small>
      )}
    </>
  )
}
