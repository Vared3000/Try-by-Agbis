import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { PriceListsPage } from '../pages/PriceListsPage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('PriceListsPage', () => {
  beforeEach(() => {
    apiClient.get.mockImplementation((url) => {
      if (url === '/price-lists') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'price-list-1',
                name: 'Основной прайс',
                validFrom: '2026-01-01',
                validTo: null,
                status: 'active',
              },
            ],
          },
        })
      }
      if (url === '/price-lists/price-list-1') {
        return Promise.resolve({
          data: {
            data: {
              id: 'price-list-1',
              name: 'Основной прайс',
              status: 'active',
              items: [
                {
                  id: 'price-item-1',
                  price: '59000',
                  nomenclatureItemId: 'nomenclature-1',
                  nomenclature: {
                    id: 'nomenclature-1',
                    name: 'Ковер шерстяной',
                    unit: 'square_meter',
                  },
                },
              ],
            },
          },
        })
      }
      if (url === '/nomenclature') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'nomenclature-1',
                name: 'Ковер шерстяной',
                unit: 'square_meter',
                unitPrice: '59000',
              },
              {
                id: 'nomenclature-2',
                name: 'Куртка',
                unit: 'piece',
                unitPrice: '220000',
              },
            ],
          },
        })
      }
      if (url === '/services') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'service-1',
                name: 'Удаление пятен',
                unit: 'item',
                category: { name: 'Дополнительная обработка' },
              },
            ],
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    apiClient.post.mockResolvedValue({ data: { data: { id: 'price-item-2' } } })
    apiClient.patch.mockResolvedValue({ data: { data: { price: '65000' } } })
  })
  afterEach(cleanup)

  it('edits an existing price', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <PriceListsPage />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
    fireEvent.change(screen.getByLabelText('Цена для Ковер шерстяной'), {
      target: { value: '650' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/price-lists/price-list-1/items/price-item-1',
        { price: '65000' },
      ),
    )
  })

  it('adds a nomenclature position to the selected price list', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <PriceListsPage />
      </QueryClientProvider>,
    )

    const combobox = await screen.findByRole('combobox', {
      name: 'Позиция номенклатуры',
    })
    fireEvent.focus(combobox)
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Куртка/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в прайс' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/price-lists/price-list-1/items', {
        nomenclatureItemId: 'nomenclature-2',
        price: '220000',
      }),
    )
  })

  it('adds a generic additional service price', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <PriceListsPage />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Дополнительная услуга' }))
    const combobox = screen.getByRole('combobox', {
      name: 'Дополнительная услуга',
    })
    fireEvent.focus(combobox)
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Удаление пятен/ }))
    fireEvent.change(screen.getByLabelText('Цена за единицу, ₽'), {
      target: { value: '900' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в прайс' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/price-lists/price-list-1/items', {
        serviceId: 'service-1',
        garmentTypeId: null,
        price: '90000',
      }),
    )
  })
})
