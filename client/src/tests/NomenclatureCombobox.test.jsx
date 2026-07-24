import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NomenclatureCombobox } from '../features/orders/NomenclatureCombobox.jsx'

const items = [
  {
    id: 'carpet-wool',
    name: 'Ковер шерстяной',
    unit: 'square_meter',
    unitPrice: '59000',
  },
  {
    id: 'carpet-synthetic',
    name: 'Ковер синтетический',
    unit: 'square_meter',
    unitPrice: '43000',
  },
  {
    id: 'trousers',
    name: 'Брюки классические',
    unit: 'piece',
    unitPrice: '90000',
  },
]

describe('nomenclature combobox', () => {
  afterEach(cleanup)

  it('filters positions by typed product name and selects a variant', () => {
    const onChange = vi.fn()
    render(<NomenclatureCombobox items={items} onChange={onChange} value="" />)
    const input = screen.getByRole('combobox', {
      name: 'Позиция номенклатуры',
    })

    fireEvent.change(input, { target: { value: 'ковер' } })

    expect(screen.getByRole('option', { name: /Ковер шерстяной/ })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Ковер синтетический/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Брюки классические/ }),
    ).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('option', { name: /Ковер шерстяной/ }))
    expect(onChange).toHaveBeenLastCalledWith('carpet-wool')
  })

  it('supports keyboard selection', () => {
    const onChange = vi.fn()
    render(<NomenclatureCombobox items={items} onChange={onChange} value="" />)
    const input = screen.getByRole('combobox', {
      name: 'Позиция номенклатуры',
    })

    fireEvent.change(input, { target: { value: 'брюки' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenLastCalledWith('trousers')
  })
})
