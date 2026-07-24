import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient } from '../../api/client.js'
import { apiError } from '../../pages/workspace-utils.js'

const emptyForm = { name: '', defectIds: [] }

export function DefectGroupsPanel() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [newDefectName, setNewDefectName] = useState('')
  const groups = useQuery({
    queryKey: ['defect-groups'],
    queryFn: async () => (await apiClient.get('/defect-groups')).data.data,
  })
  const defects = useQuery({
    queryKey: ['catalog', 'defects'],
    queryFn: async () => (await apiClient.get('/catalog/defects')).data.data,
  })
  const save = useMutation({
    mutationFn: () =>
      apiClient[editingId ? 'patch' : 'post'](
        editingId ? `/defect-groups/${editingId}` : '/defect-groups',
        form,
      ),
    onSuccess: () => {
      setModalOpen(false)
      setEditingId('')
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ['defect-groups'] })
      queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
    },
  })
  const archive = useMutation({
    mutationFn: (id) => apiClient.delete(`/defect-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defect-groups'] })
      queryClient.invalidateQueries({ queryKey: ['nomenclature'] })
    },
  })
  const createDefect = useMutation({
    mutationFn: async ({ addToGroup }) => {
      const response = await apiClient.post('/catalog/defects', {
        code: `CUSTOM_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
        name: newDefectName,
      })
      return { defect: response.data.data, addToGroup }
    },
    onSuccess: ({ defect, addToGroup }) => {
      setNewDefectName('')
      if (addToGroup) {
        setForm((value) => ({
          ...value,
          defectIds: [...new Set([...value.defectIds, defect.id])],
        }))
      }
      queryClient.invalidateQueries({ queryKey: ['catalog', 'defects'] })
    },
  })

  const submitNewDefect = (addToGroup) => {
    if (newDefectName.trim().length < 2) return
    createDefect.mutate({ addToGroup })
  }

  const openCreate = () => {
    setEditingId('')
    setForm(emptyForm)
    setModalOpen(true)
  }
  const openEdit = (group) => {
    setEditingId(group.id)
    setForm({
      name: group.name,
      defectIds: (group.defects ?? []).map((defect) => defect.id),
    })
    setModalOpen(true)
  }

  return (
    <>
      <section className="panel">
        <div className="module-toolbar">
          <div>
            <p className="eyebrow">Настройка приёмки</p>
            <h2>Группы дефектов</h2>
            <p>
              Соберите подходящие признаки один раз и назначайте группу нескольким
              позициям номенклатуры.
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={openCreate}>
            + Создать группу
          </button>
        </div>
        <div className="defect-directory-card">
          <div>
            <strong>Справочник дефектов</strong>
            <p>Добавьте формулировку, которую приёмщик увидит внутри заказа.</p>
          </div>
          <form
            className="defect-create-row"
            onSubmit={(event) => {
              event.preventDefault()
              submitNewDefect(false)
            }}
          >
            <label>
              Новый дефект
              <input
                required
                minLength="2"
                maxLength="255"
                value={newDefectName}
                onChange={(event) => setNewDefectName(event.target.value)}
                placeholder="Например, Утеряна молния или бегунок"
              />
            </label>
            <button
              className="primary-button"
              disabled={createDefect.isPending || newDefectName.trim().length < 2}
            >
              {createDefect.isPending ? 'Добавляем…' : '+ Добавить дефект'}
            </button>
          </form>
          <div className="defect-directory-list">
            {(defects.data ?? []).map((defect) => (
              <span key={defect.id}>{defect.name}</span>
            ))}
          </div>
          {createDefect.error && (
            <p className="form-error">{apiError(createDefect.error)}</p>
          )}
        </div>
        <div className="defect-group-grid">
          {(groups.data ?? []).map((group) => (
            <article className="defect-group-card" key={group.id}>
              <div>
                <strong>{group.name}</strong>
                <p>
                  {group.defects?.length
                    ? group.defects.map((defect) => defect.name).join(' · ')
                    : 'В этой группе пока нет дефектов'}
                </p>
              </div>
              <span className="table-actions">
                <button className="text-button" type="button" onClick={() => openEdit(group)}>
                  Изменить
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => archive.mutate(group.id)}
                >
                  В архив
                </button>
              </span>
            </article>
          ))}
          {!groups.isPending && !groups.data?.length && (
            <div className="empty-state compact">
              Создайте первую группу: например, «Верхняя одежда» или «Ковры».
            </div>
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
            aria-labelledby="defect-group-modal-title"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Дефекты при приёмке</p>
                <h2 id="defect-group-modal-title">
                  {editingId ? 'Редактирование группы' : 'Новая группа дефектов'}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
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
                save.mutate()
              }}
            >
              <label>
                Название группы
                <input
                  autoFocus
                  required
                  minLength="2"
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                  placeholder="Например, Верхняя одежда"
                />
              </label>
              <div className="defect-create-inline">
                <label>
                  Добавить новый дефект в эту группу
                  <input
                    minLength="2"
                    maxLength="255"
                    value={newDefectName}
                    onChange={(event) => setNewDefectName(event.target.value)}
                    placeholder="Введите название дефекта"
                  />
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={createDefect.isPending || newDefectName.trim().length < 2}
                  onClick={() => submitNewDefect(true)}
                >
                  Создать и выбрать
                </button>
              </div>
              <fieldset className="choice-checks">
                <legend>Доступные дефекты</legend>
                <div>
                  {(defects.data ?? []).map((defect) => (
                    <label key={defect.id}>
                      <input
                        type="checkbox"
                        checked={form.defectIds.includes(defect.id)}
                        onChange={() =>
                          setForm((value) => ({
                            ...value,
                            defectIds: value.defectIds.includes(defect.id)
                              ? value.defectIds.filter((id) => id !== defect.id)
                              : [...value.defectIds, defect.id],
                          }))
                        }
                      />
                      {defect.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              {!defects.isPending && !defects.data?.length && (
                <p className="form-error">
                  Сначала добавьте дефекты в справочнике «Дефекты».
                </p>
              )}
              {save.error && <p className="form-error">{apiError(save.error)}</p>}
              {createDefect.error && (
                <p className="form-error">{apiError(createDefect.error)}</p>
              )}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button className="primary-button" disabled={save.isPending}>
                  {save.isPending ? 'Сохраняем…' : 'Сохранить группу'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
