import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { apiError } from '../../pages/workspace-utils.js'
import { useCatalog } from '../../queries/catalog.js'
import { useCreateCatalogEntry } from '../../mutations/catalog.js'
import { useDefectGroups } from '../../queries/defect-groups.js'
import { useArchiveDefectGroup, useSaveDefectGroup } from '../../mutations/defect-groups.js'
import { defectGroupSchema } from '../../schemas/defect-groups.js'
import styles from './DefectGroupsPanel.module.css'

const emptyForm = { name: '', defectIds: [] }

export function DefectGroupsPanel({ onHide }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [newDefectName, setNewDefectName] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(defectGroupSchema),
    defaultValues: emptyForm,
  })
  const groups = useDefectGroups()
  const defects = useCatalog('defects')
  const save = useSaveDefectGroup()
  const archive = useArchiveDefectGroup()
  const createDefectEntry = useCreateCatalogEntry('defects')
  const createDefect = useMutation({
    mutationFn: ({ addToGroup }) =>
      createDefectEntry
        .mutateAsync({
          code: `CUSTOM_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
          name: newDefectName,
        })
        .then((defect) => ({ defect, addToGroup })),
    onSuccess: ({ defect, addToGroup }) => {
      setNewDefectName('')
      if (addToGroup) {
        setValue('defectIds', [...new Set([...getValues('defectIds'), defect.id])])
      }
    },
  })

  const submitNewDefect = (addToGroup) => {
    if (newDefectName.trim().length < 2) return
    createDefect.mutate({ addToGroup })
  }

  const openCreate = () => {
    setEditingId('')
    reset(emptyForm)
    setModalOpen(true)
  }
  const openEdit = (group) => {
    setEditingId(group.id)
    reset({
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
          <div className="table-actions">
            <button className="secondary-button" type="button" onClick={openCreate}>
              + Создать группу
            </button>
            {onHide && (
              <button className="text-button" type="button" onClick={onHide}>
                Скрыть
              </button>
            )}
          </div>
        </div>
        <div className={styles.defectDirectoryCard}>
          <div>
            <strong>Справочник дефектов</strong>
            <p>Добавьте формулировку, которую приёмщик увидит внутри заказа.</p>
          </div>
          <form
            className={styles.defectCreateRow}
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
          <div className={styles.defectDirectoryList}>
            {(defects.data ?? []).map((defect) => (
              <span key={defect.id}>{defect.name}</span>
            ))}
          </div>
          {createDefect.error && (
            <p className="form-error">{apiError(createDefect.error)}</p>
          )}
        </div>
        <div className={styles.defectGroupGrid}>
          {(groups.data ?? []).map((group) => (
            <article className={styles.defectGroupCard} key={group.id}>
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
              onSubmit={handleSubmit((values) => {
                save.mutate(
                  { id: editingId, payload: values },
                  {
                    onSuccess: () => {
                      setModalOpen(false)
                      setEditingId('')
                      reset(emptyForm)
                    },
                  },
                )
              })}
            >
              <label>
                Название группы
                <input autoFocus {...register('name')} placeholder="Например, Верхняя одежда" />
                {errors.name && (
                  <small className="field-error">{errors.name.message}</small>
                )}
              </label>
              <div className={styles.defectCreateInline}>
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
                      <Controller
                        control={control}
                        name="defectIds"
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value.includes(defect.id)}
                            onChange={() =>
                              field.onChange(
                                field.value.includes(defect.id)
                                  ? field.value.filter((id) => id !== defect.id)
                                  : [...field.value, defect.id],
                              )
                            }
                          />
                        )}
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
                <button className="primary-button" disabled={save.isPending || isSubmitting}>
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
