import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { apiClient } from '../../api/client.js'
import { apiError, money } from '../../pages/workspace-utils.js'

export function ItemPhotos({ item, editable, onChanged }) {
  const upload = useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('orderItemId', item.id)
      formData.append('file', file)
      return apiClient.post('/files', formData)
    },
    onSuccess: onChanged,
  })
  const remove = useMutation({
    mutationFn: (fileId) => apiClient.delete(`/files/${fileId}`),
    onSuccess: onChanged,
  })

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
    apiClient
      .get(`/files/${file.id}`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data)
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

export function ServiceAdder({ item, prices, onChanged }) {
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const options = prices.filter((price) => price.garmentTypeId === item.garmentTypeId)
  const addService = useMutation({
    mutationFn: () =>
      apiClient.post(`/orders/items/${item.id}/services`, {
        serviceId,
        quantity,
      }),
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
        addService.mutate()
      }}
    >
      <select
        required
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
      >
        <option value="">Выберите услугу</option>
        {options.map((price) => (
          <option key={price.id} value={price.serviceId}>
            {price.service?.name} — {money(price.price)}
          </option>
        ))}
      </select>
      <input
        required
        min="0.001"
        step="0.001"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <button className="secondary-button">Добавить услугу</button>
      {!options.length && (
        <small className="form-hint">Для изделия нет цены в активном прайсе</small>
      )}
      {addService.error && <p className="form-error">{apiError(addService.error)}</p>}
    </form>
  )
}
