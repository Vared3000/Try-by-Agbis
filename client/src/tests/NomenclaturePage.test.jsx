import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client.js'
import { NomenclaturePage } from '../pages/NomenclaturePage.jsx'

vi.mock('../api/client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('NomenclaturePage', () => {
  beforeEach(() => {
    apiClient.get.mockResolvedValue({ data: { data: [] } })
  })

  it('shows dimensions and calculates area pricing for square meters', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <NomenclaturePage />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Создать позицию/ }))
    fireEvent.change(screen.getByLabelText('Единица измерения'), {
      target: { value: 'square_meter' },
    })
    fireEvent.change(screen.getByLabelText('Длина, м'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Ширина, м'), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText('Цена за квадратный метр'), {
      target: { value: '590' },
    })

    expect(screen.getByText('6 м²')).toBeVisible()
    expect(screen.getByText(/3.*540/)).toBeVisible()
  })
})
