import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { apiClient } from '../api/client.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { apiError, money } from './workspace-utils.js'

const units = [
  ['piece', 'шт.'],
  ['square_meter', 'м²'],
  ['linear_meter', 'пог. м'],
  ['kilogram', 'кг'],
]

const unitLabels = Object.fromEntries(units)
const priceLabels = {
  piece: 'Цена за штуку',
  square_meter: 'Цена за квадратный метр',
  linear_meter: 'Цена за погонный метр',
  kilogram: 'Цена за килограмм',
}

const emptyForm = {
  name: '',
  unit: 'piece',
  price: '',
  length: '',
  width: '',
}

const numberValue = (value) => Number(String(value).replace(',', '.')) || 0

export function NomenclaturePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const list = useQuery({
    queryKey: ['nomenclature', debouncedSearch],
    queryFn: async () =>
      (
        await apiClient.get('/nomenclature', {
          params: debouncedSearch ? { search: debouncedSearch } : {},
        })
      ).data.data,
  })
  const saveItem = useMutation({
    mutationFn: async () =>
      (
        await apiClient[editingId ? 'patch' : 'post'](
          editingId ? `/nomenclature/${editingId}` : '/nomenclature',
          {
            name: form.name,
            unit: form.unit,
            unitPrice: String(Math.round(numberValue(form.price) * 100)),
          },
        )
      ).data.data,
    onSuccess: (item) => {
      setForm(emptyForm)
      setEditingId('')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
      window.setTimeout(() => {
        document.getElementById(`nomenclature-${item.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 100)
    },
  })
  const archiveItem = useMutation({
    mutationFn: (id) => apiClient.delete(`/nomenclature/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomenclature'] }),
  })
  const preview = useMemo(() => {
    if (form.unit !== 'square_meter') return null
    const length = numberValue(form.length)
    const width = numberValue(form.width)
    const price = numberValue(form.price)
    const area = length * width
    return { length, width, area, total: area * price }
  }, [form])

  const openCreate = () => {
    setEditingId('')
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditingId(row.id)
    setForm({
      ...emptyForm,
      name: row.name,
      unit: row.unit,
      price: String(Number(row.unitPrice) / 100),
    })
    setModalOpen(true)
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="module-toolbar">
          <div>
            <p className="eyebrow">Справочник</p>
            <h2>Номенклатура</h2>
            <p>Позиции, единицы измерения и правила расчёта стоимости.</p>
          </div>
          <button className="primary-button" onClick={openCreate}>
            + Создать позицию
          </button>
        </div>
        <div className="table-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию"
          />
          <span>{list.data?.length ?? 0} позиций</span>
        </div>
        <div className="responsive-table">
          <div className="table-row table-head">
            <span>Имя позиции</span>
            <span>Единица</span>
            <span>Цена за единицу</span>
            <span>Тип расчёта</span>
            <span />
          </div>
          {(list.data ?? []).map((row) => (
            <div className="table-row" id={`nomenclature-${row.id}`} key={row.id}>
              <strong>{row.name}</strong>
              <span>{unitLabels[row.unit] || row.unit}</span>
              <strong>{money(row.unitPrice)}</strong>
              <span>
                {{
                  quantity: 'По количеству',
                  area: 'По площади',
                  length: 'По длине',
                  weight: 'По весу',
                }[row.calculationType] || row.calculationType}
              </span>
              <span className="table-actions">
                <button className="text-button" onClick={() => openEdit(row)}>
                  Изменить
                </button>
                <button
                  className="text-button danger"
                  onClick={() => archiveItem.mutate(row.id)}
                >
                  В архив
                </button>
              </span>
            </div>
          ))}
          {!list.isPending && !list.data?.length && (
            <div className="empty-state compact">Позиции не найдены</div>
          )}
        </div>
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nomenclature-modal-title"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Номенклатура</p>
                <h2 id="nomenclature-modal-title">
                  {editingId ? 'Редактирование позиции' : 'Новая позиция'}
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault()
                saveItem.mutate()
              }}
            >
              <label>
                Имя позиции
                <input
                  autoFocus
                  required
                  minLength="2"
                  maxLength="255"
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                  placeholder="Например, Ковер шерстяной"
                />
              </label>
              <label>
                Единица измерения
                <select
                  value={form.unit}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      unit: event.target.value,
                      length: '',
                      width: '',
                    }))
                  }
                >
                  {units.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {form.unit === 'square_meter' && (
                <fieldset className="dynamic-fields">
                  <legend>Предварительный расчёт площади</legend>
                  <div className="form-grid">
                    <label>
                      Длина, м
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={form.length}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            length: event.target.value,
                          }))
                        }
                        placeholder="2"
                      />
                    </label>
                    <label>
                      Ширина, м
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={form.width}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            width: event.target.value,
                          }))
                        }
                        placeholder="3"
                      />
                    </label>
                  </div>
                  <small>
                    Размеры используются только для примера. Фактические размеры вводятся
                    в заказе.
                  </small>
                </fieldset>
              )}

              <label>
                {priceLabels[form.unit]}
                <div className="input-suffix">
                  <input
                    aria-label={priceLabels[form.unit]}
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, price: event.target.value }))
                    }
                    placeholder="590"
                  />
                  <span>₽/{unitLabels[form.unit]}</span>
                </div>
              </label>

              {preview && (
                <div className="calculation-preview">
                  <span>Площадь</span>
                  <strong>{preview.area.toLocaleString('ru-RU')} м²</strong>
                  <span>Расчёт</span>
                  <strong>
                    {preview.length || 0} × {preview.width || 0} ×{' '}
                    {numberValue(form.price).toLocaleString('ru-RU')} ₽
                  </strong>
                  <span>Итоговая стоимость</span>
                  <strong className="preview-total">
                    {preview.total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                    })}
                  </strong>
                </div>
              )}
              {saveItem.error && <p className="form-error">{apiError(saveItem.error)}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button className="primary-button" disabled={saveItem.isPending}>
                  {saveItem.isPending
                    ? 'Сохраняем…'
                    : editingId
                      ? 'Сохранить'
                      : 'Создать позицию'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
