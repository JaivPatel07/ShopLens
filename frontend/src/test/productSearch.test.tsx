import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductFlowProvider } from '../context/ProductFlowContext'
import { useProductFlow } from '../context/productFlow'
import { LoadingState } from '../components/LoadingState'
import { ProductIdentification } from '../components/ProductIdentification'
import { ProductGrid } from '../components/ProductGrid'
import { BestDealCard } from '../components/BestDealCard'
import { ErrorState } from '../components/ErrorState'
import { makeAnalysis, makeImageFile, makeProduct, makeSearchResponse } from './factories'
import type { Recommendation } from '../types/product'

const analyzeImage = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => vi.fn())

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    code = 'x'
    status = 0
  },
  api: { analyzeImage, search, config: vi.fn(), health: vi.fn() },
}))

/** Minimal harness that exposes the flow controller to the test. */
function FlowHarness({ onReady }: { onReady: (flow: ReturnType<typeof useProductFlow>) => void }) {
  const flow = useProductFlow()
  onReady(flow)
  return (
    <div>
      <p data-testid="status">{`${flow.analyzeStatus}/${flow.searchStatus}`}</p>
      <p data-testid="query">{flow.searchQuery}</p>
      <p data-testid="count">{flow.search?.products.length ?? 0}</p>
      <p data-testid="error">{flow.analyzeError ?? ''}</p>
    </div>
  )
}

function renderHarness() {
  let flow: ReturnType<typeof useProductFlow> | null = null
  render(
    <ProductFlowProvider>
      <FlowHarness onReady={(value) => (flow = value)} />
    </ProductFlowProvider>,
  )
  return () => flow as ReturnType<typeof useProductFlow>
}

describe('product search flow', () => {
  beforeEach(() => {
    analyzeImage.mockReset()
    search.mockReset()
  })

  it('runs identify → search and stores the results', async () => {
    analyzeImage.mockResolvedValue(makeAnalysis())
    search.mockResolvedValue(makeSearchResponse())

    const getFlow = renderHarness()
    const user = userEvent.setup()

    await act(async () => {
      getFlow().selectImage(makeImageFile())
    })

    await act(async () => {
      await getFlow().analyzeImage()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('success/idle')
    expect(screen.getByTestId('query')).toHaveTextContent("Nike Air Max 270 black men's shoes")

    await act(async () => {
      await getFlow().runSearch(getFlow().searchQuery)
    })

    expect(screen.getByTestId('status')).toHaveTextContent('success/success')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(search).toHaveBeenCalledWith({ query: "Nike Air Max 270 black men's shoes", force_refresh: false })
    void user
  })

  it('surfaces a friendly error when recognition fails', async () => {
    const { ApiError } = await import('../services/api')
    analyzeImage.mockRejectedValue(new ApiError("We couldn't confidently identify this product."))

    const getFlow = renderHarness()
    await act(async () => {
      getFlow().selectImage(makeImageFile())
    })
    await act(async () => {
      await getFlow().analyzeImage()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('error/idle')
    expect(screen.getByTestId('error')).toHaveTextContent(/couldn't confidently identify/i)
  })

  it('can search with a manual query after local recognition is unavailable', async () => {
    const { ApiError } = await import('../services/api')
    analyzeImage.mockRejectedValue(
      new ApiError('Local image recognition is unavailable. Enter a product name manually.'),
    )
    search.mockResolvedValue(makeSearchResponse({ query: 'black running shoes' }))

    const getFlow = renderHarness()
    await act(async () => {
      getFlow().selectImage(makeImageFile())
    })
    await act(async () => {
      await getFlow().analyzeImage()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('error/idle')

    await act(async () => {
      getFlow().setQuery('black running shoes')
      await getFlow().runSearch('black running shoes')
    })
    expect(screen.getByTestId('status')).toHaveTextContent('error/success')
    expect(search).toHaveBeenCalledWith({ query: 'black running shoes', force_refresh: false })
  })

  it('clears everything when the image is removed', async () => {
    analyzeImage.mockResolvedValue(makeAnalysis())
    const getFlow = renderHarness()

    await act(async () => {
      getFlow().selectImage(makeImageFile())
    })
    await act(async () => {
      await getFlow().analyzeImage()
    })
    await act(async () => {
      getFlow().clearImage()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('idle/idle')
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })
})

describe('LoadingState', () => {
  it('marks completed and active stages', () => {
    render(
      <LoadingState
        title="Analyzing your image…"
        stages={[
          { label: 'Image uploaded', done: true },
          { label: 'Identifying product', done: false, active: true },
          { label: 'Finding matching products', done: false },
        ]}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Analyzing your image')
    expect(screen.getByText('Identifying product')).toBeInTheDocument()
  })
})

describe('ProductIdentification', () => {
  it('lets the user edit the generated query', async () => {
    const onQueryChange = vi.fn()
    const onSearch = vi.fn()
    render(
      <ProductIdentification
        analysis={makeAnalysis()}
        query="nike air max 270"
        onQueryChange={onQueryChange}
        onSearch={onSearch}
      />,
    )

    expect(screen.getByText('Nike Air Max 270')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /edit search query/i }))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'nike air max 270 cream')
    await userEvent.click(screen.getByRole('button', { name: /save search query/i }))

    expect(onQueryChange).toHaveBeenCalledWith('nike air max 270 cream')

    await userEvent.click(screen.getByRole('button', { name: /search products/i }))
    expect(onSearch).toHaveBeenCalled()
  })

  it('flags demo recognition data', () => {
    render(
      <ProductIdentification
        analysis={makeAnalysis({ is_demo: true })}
        query="q"
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    expect(screen.getByText(/demo data/i)).toBeInTheDocument()
  })
})

describe('ProductGrid', () => {
  it('renders skeletons while loading', () => {
    render(<ProductGrid products={[]} loading skeletonCount={3} />)
    expect(screen.getByLabelText(/loading products/i)).toBeInTheDocument()
  })

  it('renders products and copes with missing optional fields', () => {
    const products = [
      makeProduct(),
      makeProduct({
        id: 'no-data',
        title: 'Mystery sneaker',
        price: null,
        price_formatted: null,
        original_price: null,
        original_price_formatted: null,
        discount_percent: null,
        rating: null,
        reviews: null,
        thumbnail: null,
        source: null,
        link: null,
        value_score: null,
      }),
    ]
    render(<ProductGrid products={products} />)

    expect(screen.getByText('Nike Air Max 270')).toBeInTheDocument()
    expect(screen.getByText('Mystery sneaker')).toBeInTheDocument()
    expect(screen.getByText('No image')).toBeInTheDocument()
    expect(screen.getByText('No rating yet')).toBeInTheDocument()
    expect(screen.getByText('Link unavailable')).toBeInTheDocument()
    expect(screen.getByText('15% OFF')).toBeInTheDocument()
  })

  it('shows a helpful empty state', () => {
    render(<ProductGrid products={[]} />)
    expect(screen.getByText(/no products match these filters/i)).toBeInTheDocument()
  })
})

describe('BestDealCard', () => {
  const recommendation: Recommendation = {
    product: makeProduct(),
    reason: 'best_value',
    headline: 'Best value pick',
    explanation: 'Best value score of 82/100 across 8 priced results.',
    savings: 1500,
    savings_formatted: '₹1,500',
    value_score: 82.1,
    confidence: 'high',
    alternatives: [],
  }

  it('shows the pick, the reasoning and the transparency note', () => {
    render(<BestDealCard recommendation={recommendation} />)
    expect(screen.getByText(/best value pick/i)).toBeInTheDocument()
    expect(screen.getByText('₹8,499')).toBeInTheDocument()
    expect(screen.getByText(/save ₹1,500 vs highest price/i)).toBeInTheDocument()
    expect(screen.getByText(/considers price, rating and available review information/i)).toBeInTheDocument()
  })

  it('refuses to invent a winner when the data is insufficient', () => {
    render(
      <BestDealCard
        recommendation={{
          product: null,
          reason: 'insufficient_data',
          headline: 'Not enough data for a confident pick',
          explanation: 'None of the results returned a usable price.',
          savings: null,
          savings_formatted: null,
          value_score: null,
          confidence: 'low',
          alternatives: [],
        }}
      />,
    )
    expect(screen.getByText(/none of the results returned a usable price/i)).toBeInTheDocument()
    expect(screen.getByText(/best deal/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view deal/i })).not.toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('renders suggestions and a retry action', async () => {
    const onRetry = vi.fn()
    render(
      <ErrorState
        title="No product detected"
        message="We couldn't confidently identify this product."
        suggestions={['A clearer photo', 'Better lighting']}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/no product detected/i)
    expect(screen.getByText('Better lighting')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('search history', () => {
  it('persists entries to localStorage with a bounded size', async () => {
    const { useSearchHistory } = await import('../hooks/useSearchHistory')
    const { renderHook, act: hookAct } = await import('@testing-library/react')

    const { result } = renderHook(() => useSearchHistory())

    hookAct(() => {
      for (let index = 0; index < 15; index += 1) {
        result.current.addEntry({
          productName: `Product ${index}`,
          query: `query ${index}`,
          lowestPrice: 100 + index,
          lowestPriceFormatted: `₹${100 + index}`,
          sellerCount: 1,
          productCount: 2,
          thumbnail: null,
          isDemo: false,
        })
      }
    })

    await waitFor(() => expect(result.current.history.length).toBe(12))
    expect(result.current.history[0].query).toBe('query 14')
    expect(window.localStorage.getItem('snapbuy.history.v1')).toContain('query 14')

    hookAct(() => result.current.clearHistory())
    await waitFor(() => expect(result.current.history).toHaveLength(0))
  })
})

describe('search mode isolation & race conditions', () => {
  it('keeps text search and image search states strictly separated', async () => {
    const getFlow = renderHarness()

    await act(async () => {
      getFlow().setTextQuery('iPhone 17')
    })
    expect(getFlow().textQuery).toBe('iPhone 17')

    await act(async () => {
      getFlow().selectImage(makeImageFile())
      getFlow().setImageQuery('Nike Air Max 270')
    })

    expect(getFlow().imageQuery).toBe('Nike Air Max 270')
    expect(getFlow().textQuery).toBe('iPhone 17')
    expect(getFlow().hasImage).toBe(true)

    // Switch mode back to text: image query is not leaked
    await act(async () => {
      getFlow().setMode('text')
    })
    expect(getFlow().searchQuery).toBe('iPhone 17')
  })

  it('searches for iPhone 17 after previous sneaker search without contamination', async () => {
    search.mockResolvedValue(makeSearchResponse({ query: 'iPhone 17' }))
    const getFlow = renderHarness()

    await act(async () => {
      getFlow().selectImage(makeImageFile())
      getFlow().setImageQuery('Nike sneakers')
    })

    await act(async () => {
      await getFlow().runTextSearch('iPhone 17')
    })

    expect(search).toHaveBeenCalledWith({ query: 'iPhone 17', force_refresh: false })
    expect(getFlow().search?.query).toBe('iPhone 17')
    expect(getFlow().mode).toBe('text')
    expect(getFlow().hasImage).toBe(false)
  })

  it('ignores stale asynchronous responses when newer queries are submitted', async () => {
    let resolveFirst: (val: any) => void = () => {}
    search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    search.mockImplementationOnce(() => Promise.resolve(makeSearchResponse({ query: 'Query Two' })))

    const getFlow = renderHarness()

    let firstPromise: Promise<any>
    await act(async () => {
      firstPromise = getFlow().runTextSearch('Query One')
    })

    await act(async () => {
      await getFlow().runTextSearch('Query Two')
    })

    expect(getFlow().search?.query).toBe('Query Two')

    // Now resolve the first, stale search
    await act(async () => {
      resolveFirst(makeSearchResponse({ query: 'Query One' }))
      await firstPromise
    })

    // Active result must NOT be overwritten by the stale first response
    expect(getFlow().search?.query).toBe('Query Two')
  })
})

