import { useMemo, useState } from 'react'

import { DefectGroupsPanel } from '../features/nomenclature/DefectGroupsPanel.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useDefectGroups } from '../queries/defect-groups.js'
import { useNomenclature } from '../queries/nomenclature.js'
import { useArchiveNomenclatureItem, useSaveNomenclatureItem } from '../mutations/nomenclature.js'
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
  leadTimeHours: '48',
  defectGroupId: '',
}

const numberValue = (value) => Number(String(value).replace(',', '.')) || 0

export function NomenclaturePage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [defectGroupsOpen, setDefectGroupsOpen] = useState(false)
  const list = useNomenclature(debouncedSearch)
  const defectGroups = useDefectGroups()
  const saveItem = useSaveNomenclatureItem()
  const archiveItem = useArchiveNomenclatureItem()
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
      leadTimeHours: String(row.leadTimeHours ?? 48),
      defectGroupId: row.defectGroupId ?? '',
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
            <span>Норматив</span>
            <span />
          </div>
          {(list.data ?? []).map((row) => (
            <div className="table-row" id={`nomenclature-${row.id}`} key={row.id}>
              <span>
                <strong>{row.name}</strong>
                <small className="nomenclature-defect-group">
                  {row.defectGroup?.name || 'Все дефекты'}
                </small>
              </span>
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
              <span>{row.leadTimeHours ?? 48} ч</span>
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

      {defectGroupsOpen ? (
        <DefectGroupsPanel onHide={() => setDefectGroupsOpen(false)} />
      ) : (
        <button
          className="secondary-button defect-groups-toggle"
          type="button"
          onClick={() => setDefectGroupsOpen(true)}
        >
          Дефекты и группы при приёмке
        </button>
      )}

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
                saveItem.mutate(
                  {
                    id: editingId,
                    payload: {
                      name: form.name,
                      unit: form.unit,
                      unitPrice: String(Math.round(numberValue(form.price) * 100)),
                      leadTimeHours: Number(form.leadTimeHours),
                      defectGroupId: form.defectGroupId || null,
                    },
                  },
                  {
                    onSuccess: (item) => {
                      setForm(emptyForm)
                      setEditingId('')
                      setModalOpen(false)
                      window.setTimeout(() => {
                        document.getElementById(`nomenclature-${item.id}`)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        })
                      }, 100)
                    },
                  },
                )
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
              <label>
                Группа дефектов при приёмке
                <select
                  value={form.defectGroupId}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      defectGroupId: event.target.value,
                    }))
                  }
                >
                  <option value="">Общий список — все дефекты</option>
                  {(defectGroups.data ?? []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <small>
                  В заказе приёмщик увидит только дефекты из выбранной группы.
                </small>
              </label>
              <label>
                Норматив готовности, часов
                <input
                  required
                  type="number"
                  min="1"
                  max={24 * 60}
                  step="1"
                  value={form.leadTimeHours}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      leadTimeHours: event.target.value,
                    }))
                  }
                />
                <small>Используется для автоматического расчёта срока заказа.</small>
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
