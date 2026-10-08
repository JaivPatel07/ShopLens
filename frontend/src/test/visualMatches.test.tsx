import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VisualMatches } from '../components/VisualMatches'
import { makeImageFile } from './factories'

const visualSimilar = vi.hoisted(() => vi.fn())

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    code = 'x'
    status = 0
  },
  api: { visualSimilar },
}))

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lens-1-test',
    title: 'Nike Air Max 270 Black Anthracite',
    source: 'Myntra',
    link: 'https://example.com/deal',
    thumbnail: 'https://example.com/thumb.jpg',
    price: 8499,
    currency: 'INR',
    price_formatted: '₹8,499',
    rating: 4.6,
    reviews: 1234,
    in_stock: true,
    is_demo: false,
    ...overrides,
  }
}

describe('VisualMatches', () => {
  it('renders visual matches for the uploaded photo', async () => {
    visualSimilar.mockResolvedValue({
      matches: [makeMatch(), makeMatch({ id: 'lens-2', title: 'Air Max React' })],
      engine: 'google_lens',
      count: 2,
      is_demo: false,
      notes: [],
    })

    render(<VisualMatches imageFile={makeImageFile()} />)

    await waitFor(() =>
      expect(screen.getByText('Nike Air Max 270 Black Anthracite')).toBeInTheDocument(),
    )
    expect(screen.getByText('Air Max React')).toBeInTheDocument()
    expect(screen.getAllByText('₹8,499')).toHaveLength(2)
    expect(screen.queryByText('Demo')).not.toBeInTheDocument()
  })

  it('labels demo results', async () => {
    visualSimilar.mockResolvedValue({
      matches: [makeMatch({ is_demo: true })],
      engine: 'google_lens (demo fixture)',
      count: 1,
      is_demo: true,
      notes: [],
    })

    render(<VisualMatches imageFile={makeImageFile()} />)

    await waitFor(() => expect(screen.getByText('Demo')).toBeInTheDocument())
  })

  it('stays quiet when the Lens request fails', async () => {
    visualSimilar.mockRejectedValue(new Error('offline'))

    render(<VisualMatches imageFile={makeImageFile()} />)

    await waitFor(() =>
      expect(
        screen.getByText(/visual matching is unavailable right now/i),
      ).toBeInTheDocument(),
    )
  })

  it('renders nothing without a photo', () => {
    render(<VisualMatches imageFile={null} />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(visualSimilar).not.toHaveBeenCalled()
  })
})
