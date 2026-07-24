import { useId, useMemo, useState } from 'react'

import { money } from '../../pages/workspace-utils.js'

const normalize = (value) =>
  String(value).trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е')

const unitLabels = {
  item: 'шт.',
  piece: 'шт.',
  square_meter: 'м²',
  linear_meter: 'пог. м',
  kilogram: 'кг',
}

export function ServiceCombobox({
  items,
  label = 'Услуга',
  onChange,
  placeholder = 'Начните вводить название услуги…',
  value,
}) {
  const inputId = useId()
  const listId = `${inputId}-list`
  const selectedItem = items.find((item) => item.id === value)
  const [inputState, setInputState] = useState({
    forValue: value,
    text: selectedItem?.name ?? '',
  })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const text =
    inputState.forValue === value ? inputState.text : (selectedItem?.name ?? '')
  const filteredItems = useMemo(() => {
    const words = normalize(text).split(/\s+/).filter(Boolean)
    if (!words.length) return items.slice(0, 30)
    return items
      .filter((item) => {
        const searchable = normalize(
          `${item.name} ${item.category?.name ?? ''} ${unitLabels[item.unit] ?? item.unit ?? ''}`,
        )
        return words.every((word) => searchable.includes(word))
      })
      .slice(0, 30)
  }, [items, text])

  const selectItem = (item) => {
    setInputState({ forValue: item.id, text: item.name })
    setOpen(false)
    setActiveIndex(0)
    onChange(item.id)
  }

  return (
    <div className="nomenclature-combobox service-combobox field-wide">
      <label htmlFor={inputId}>{label}</label>
      <div className="combobox-input-wrap">
        <input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={
            open && filteredItems[activeIndex]
              ? `${listId}-${filteredItems[activeIndex].id}`
              : undefined
          }
          placeholder={placeholder}
          value={text}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            const nextText = event.target.value
            const nextValue = nextText === selectedItem?.name ? value : ''
            setInputState({ forValue: nextValue, text: nextText })
            setActiveIndex(0)
            setOpen(true)
            if (nextValue !== value) onChange(nextValue)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(filteredItems.length - 1, 0)),
              )
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter' && open && filteredItems[activeIndex]) {
              event.preventDefault()
              selectItem(filteredItems[activeIndex])
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        <span aria-hidden="true">⌕</span>
      </div>
      {open && (
        <div className="combobox-dropdown">
          <div className="combobox-results-count">
            {filteredItems.length
              ? `Найдено услуг: ${filteredItems.length}`
              : 'Подходящих услуг в прайс-листе нет'}
          </div>
          <div id={listId} role="listbox">
            {filteredItems.map((item, index) => (
              <button
                key={item.id}
                id={`${listId}-${item.id}`}
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={index === activeIndex ? 'active' : ''}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectItem(item)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {[item.category?.name, unitLabels[item.unit] ?? item.unit]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                {item.price != null && <strong>{money(item.price)}</strong>}
              </button>
            ))}
          </div>
        </div>
      )}
      {!value && text && (
        <small className="combobox-hint">Выберите конкретную услугу из списка.</small>
      )}
    </div>
  )
}
