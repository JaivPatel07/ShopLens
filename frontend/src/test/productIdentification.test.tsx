// Appended by antigravity: tests for confidence display fixes in ProductIdentification

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductIdentification } from '../components/ProductIdentification'
import { makeAnalysis } from './factories'

describe('ProductIdentification — confidence display', () => {
  it('shows progress bar with percentage when confidence is a positive number', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis({ confidence: 0.85, detected: true })}
        query=""
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(screen.getByRole('progressbar', { name: /recognition confidence/i })).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    // Must NOT show the "not confidently identified" label
    expect(screen.queryByText(/not confidently identified/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recognition unavailable/i)).not.toBeInTheDocument()
  })

  it('never shows 0% when confidence is null — shows "not confidently identified" instead', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis({
          confidence: null,
          detected: false,
          product_name: 'Product not confidently identified',
          search_query: '',
        })}
        query=""
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    // The text appears in the product name h2 AND in the confidence dd badge
    expect(screen.getAllByText(/not confidently identified/i).length).toBeGreaterThanOrEqual(1)
  })

  it('never shows 0% when confidence is 0 and detected is false', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis({ confidence: 0, detected: false })}
        query=""
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('displays "Visual matches found" badge when lensMatchCount > 0', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis({ confidence: null, detected: false })}
        query=""
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        lensMatchCount={6}
      />,
    )
    // Both the header badge and the dl badge should mention the count
    expect(screen.getAllByText(/visual matches found/i).length).toBeGreaterThan(0)
  })

  it('does NOT display the Lens badge when lensMatchCount is 0', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis()}
        query=""
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        lensMatchCount={0}
      />,
    )
    // "Visual matches found" should not appear in badge form for 0 matches
    expect(screen.queryByText(/visual matches found \(/i)).not.toBeInTheDocument()
  })

  it('renders suggested queries and calls onQueryChange when clicked', async () => {
    const onQueryChange = vi.fn()
    render(
      <ProductIdentification
        analysis={makeAnalysis({ confidence: null, detected: false })}
        query=""
        onQueryChange={onQueryChange}
        onSearch={vi.fn()}
        lensMatchCount={2}
        suggestedQueries={['Chanel No. 5 perfume', 'Dior Sauvage EDT 100ml']}
      />,
    )
    expect(screen.getByText('Chanel No. 5 perfume')).toBeInTheDocument()
    expect(screen.getByText('Dior Sauvage EDT 100ml')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Chanel No. 5 perfume'))
    expect(onQueryChange).toHaveBeenCalledWith('Chanel No. 5 perfume')
  })

  it('does not show suggestions panel when suggestedQueries is empty', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis()}
        query="Nike Air Max"
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        suggestedQueries={[]}
      />,
    )
    expect(screen.queryByText(/suggested queries from google lens/i)).not.toBeInTheDocument()
  })

  it('keeps Lens status completely separate from the recognition confidence bar', () => {
    // When Google Lens returns results but OWL-ViT is confident,
    // both the confidence bar AND the Lens count badge should show independently.
    render(
      <ProductIdentification
        analysis={makeAnalysis({ confidence: 0.78, detected: true })}
        query="Nike Air Max"
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        lensMatchCount={4}
      />,
    )
    // Confidence bar present
    expect(screen.getByRole('progressbar', { name: /recognition confidence/i })).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    // Lens badge present (may appear in multiple places — just confirm at least one)
    expect(screen.getAllByText(/visual matches found/i).length).toBeGreaterThan(0)
    // No "not identified" label
    expect(screen.queryByText(/not confidently identified/i)).not.toBeInTheDocument()
  })
})
