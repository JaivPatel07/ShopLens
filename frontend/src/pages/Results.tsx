import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Filter as FilterIcon,
  Info,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useProductFlow } from '../context/productFlow'
import { FilterBar } from '../components/FilterBar'
import { ProductGrid } from '../components/ProductGrid'
import { PriceComparison } from '../components/PriceComparison'
import { VisualMatches } from '../components/VisualMatches'
import { BestDealCard } from '../components/BestDealCard'
import { SearchSummary } from '../components/SearchSummary'
import { RefineSearch } from '../components/RefineSearch'
import { buildRefinements } from '../lib/search'
import { ImagePreview } from '../components/ImagePreview'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { DemoBadge } from '../components/DemoBadge'
import type { FilterState, SearchResponse } from '../types/product'
import {
  DEFAULT_FILTERS,
  applyFilters,
  availableSellers as deriveSellers,
  highestRating,
  priceBounds as derivePriceBounds,
} from '../lib/filters'
import { cx, formatPrice } from '../lib/format'
import { createThumbnailDataUrl } from '../lib/image'
import { useSearchHistory } from '../hooks/useSearchHistory'

const PAGE_SIZE = 12

export default function Results() {
  const flow = useProductFlow()
  const navigate = useNavigate()
  const { addEntry } = useSearchHistory()

  const search = flow.search
  const products = useMemo(() => search?.products ?? [], [search])

  const [inputQuery, setInputQuery] = useState(search?.query ?? flow.searchQuery ?? '')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    if (search?.query) {
      setInputQuery(search.query)
      setVisibleCount(PAGE_SIZE)
    }
  }, [search?.query])

  const [filterState, setFilterState] = useState<{ forQuery: string; filters: FilterState }>({
    forQuery: '',
    filters: DEFAULT_FILTERS,
  })
  const resultKey = search?.query ?? ''
  const filters = filterState.forQuery === resultKey ? filterState.filters : DEFAULT_FILTERS
  const setFilters = (next: FilterState) => setFilterState({ forQuery: resultKey, filters: next })

  const filtered = useMemo(
    () => applyFilters(products, filters, search?.best_deal?.product?.id ?? null),
    [products, filters, search?.best_deal?.product?.id],
  )

  const displayedProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  )

  const availableSellers = useMemo(() => deriveSellers(products), [products])
  const priceBounds = useMemo(() => derivePriceBounds(products), [products])
  const ratingBounds = useMemo(() => highestRating(products), [products])

  const isImageMode = flow.searchMode === 'image' || (flow.mode === 'image' && Boolean(flow.imageFile))

  const refinements = useMemo(
    () =>
      buildRefinements(
        search?.query ?? '',
        isImageMode ? (flow.analysis?.attributes ?? []) : [],
      ),
    [search?.query, isImageMode, flow.analysis?.attributes],
  )

  const recordHistory = async (response: SearchResponse) => {
    let thumbnail: string | null = null
    if (isImageMode && flow.imageFile) {
      thumbnail = await createThumbnailDataUrl(flow.imageFile, 128)
    }
    addEntry({
      productName: isImageMode && flow.analysis?.product_name ? flow.analysis.product_name : response.query,
      query: response.query,
      lowestPrice: response.summary.lowest_price,
      lowestPriceFormatted: response.summary.lowest_price_formatted ?? null,
      sellerCount: response.summary.seller_count,
      productCount: response.summary.count,
      thumbnail,
      isDemo: response.is_demo,
    })
  }

  const handleSearch = (query: string) => {
    const cleaned = query.trim()
    if (!cleaned) return
    flow.setQuery(cleaned)
    if (isImageMode && flow.imageFile) {
      void flow.runImageSearch(cleaned).then((res) => {
        if (res) void recordHistory(res)
      })
    } else {
      void flow.runTextSearch(cleaned).then((res) => {
        if (res) void recordHistory(res)
      })
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(inputQuery)
  }

  const handleNewSearch = () => {
    flow.reset()
    navigate('/')
  }

  if (!search && !flow.isSearching) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
          <span className="bg-brand-50 text-brand-600 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <Search className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">No results to show yet</h1>
          <p className="text-ink-600 mt-3 text-sm leading-relaxed">
            Search for any product name or upload a product photo to find live prices and comparable offers.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/" onClick={() => flow.reset()} className="btn-primary btn-lg inline-flex items-center gap-2">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Upload a product photo or search by text
            </Link>
            <button type="button" onClick={handleNewSearch} className="btn-secondary btn-lg">
              Start a new search
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pageTitle =
    isImageMode && flow.analysis?.product_name
      ? flow.analysis.product_name
      : (search?.query || flow.searchQuery || 'Product Results')

  return (
    <div className="pb-24">
      <header className="border-ink-100 bg-ink-50/40 border-b py-8">
        <div className="container-page">
          <div className="flex items-center justify-between gap-4 mb-5">
            <button
              type="button"
              onClick={handleNewSearch}
              className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-2 text-sm font-medium transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              New search
            </button>

            {/* Explicit search mode indicator */}
            <div className="flex items-center gap-2">
              {isImageMode ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 shadow-xs">
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  Search by Image (Google Lens)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-xs">
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Search by Text (Google Shopping)
                </span>
              )}
              {search?.is_demo && <DemoBadge />}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
            {/* Show image thumbnail strictly when in image search mode */}
            {isImageMode && flow.imagePreview && (
              <ImagePreview
                src={flow.imagePreview}
                fileName={flow.imageFile?.name}
                onRemove={handleNewSearch}
                compact
                className="max-w-[140px] sm:max-w-[160px]"
              />
            )}

            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-ink-900">
                {pageTitle}
              </h1>

              <div className="text-ink-600 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {flow.isSearching
                    ? 'Searching live offers…'
                    : flow.searchStatus === 'error'
                      ? 'The search did not complete'
                      : (
                        <>
                          <strong className="text-ink-900 font-semibold">
                            {search?.summary.count ?? 0}
                          </strong>{' '}
                          products found
                        </>
                      )}
                </span>
                {search?.summary.seller_count ? (
                  <span>· Across {search.summary.seller_count} sellers</span>
                ) : null}
                {search?.elapsed_ms !== null && search?.elapsed_ms !== undefined && (
                  <span className="text-ink-400">· {(search.elapsed_ms / 1000).toFixed(1)}s</span>
                )}
                {search?.engine && !search.is_demo && (
                  <span className="chip">engine: {search.engine}</span>
                )}
              </div>

              {isImageMode && flow.analysis && (
                <p className="text-ink-500 mt-2 text-sm">
                  {[flow.analysis.brand, flow.analysis.category].filter(Boolean).join(' · ')}
                  {flow.analysis.description ? ` — ${flow.analysis.description}` : ''}
                </p>
              )}

              {/* Editable search query bar directly on results page */}
              <form onSubmit={handleFormSubmit} className="mt-4 flex max-w-xl items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="text-ink-400 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Refine search query..."
                    className="field !py-1.5 !pl-9 !text-sm w-full"
                  />
                </div>
                <button
                  type="submit"
                  disabled={flow.isSearching || !inputQuery.trim()}
                  className="btn-primary !px-3.5 !py-1.5 text-xs shrink-0"
                >
                  <RefreshCw className={cx('h-3.5 w-3.5', flow.isSearching && 'animate-spin')} />
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page space-y-10 pt-10">
        {flow.searchStatus === 'error' && (
          <ErrorState
            title="Something went wrong while searching"
            message={flow.searchError ?? 'Please try again in a moment.'}
            suggestions={[
              'Check the search query and try simplifying it',
              'Try again — search providers occasionally rate-limit requests',
            ]}
            onRetry={() => handleSearch(search?.query ?? flow.searchQuery)}
            retryLabel="Search again"
          />
        )}

        {flow.isSearching && (
          <>
            <LoadingState
              title="Finding matching products…"
              subtitle={
                isImageMode
                  ? 'Searching Google Lens & Google Shopping with your visual cues.'
                  : 'SerpApi is searching Google Shopping for the best live deals.'
              }
              stages={[
                { label: 'Query prepared', done: true },
                { label: 'Finding matching products', done: false, active: true },
                { label: 'Comparing prices across sellers', done: false },
              ]}
            />
            <ProductGrid products={[]} loading skeletonCount={8} />
          </>
        )}

        {!flow.isSearching && search && (
          <>
            {search.notes.length > 0 && (
              <ul className="space-y-2">
                {search.notes.map((note) => (
                  <li
                    key={note}
                    className={cx(
                      'flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed',
                      search.is_demo
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-ink-100 bg-ink-50 text-ink-600',
                    )}
                  >
                    {search.is_demo ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {note}
                  </li>
                ))}
              </ul>
            )}

            {products.length > 0 ? (
              <>
                <SearchSummary summary={search.summary} />

                <BestDealCard recommendation={search.best_deal} currency={search.summary.currency} />

                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  availableSellers={availableSellers}
                  priceBounds={priceBounds}
                  ratingBounds={ratingBounds}
                  totalCount={products.length}
                  shownCount={filtered.length}
                  currency={search.summary.currency}
                />

                <section aria-labelledby="products-heading">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <h2 id="products-heading" className="text-lg font-semibold sm:text-xl">
                      {filtered.length} product{filtered.length === 1 ? '' : 's'}
                      {filters.sellers.length > 0 || filters.minRating !== null ? ' (filtered)' : ''}
                    </h2>
                    {priceBounds && (
                      <p className="text-ink-500 text-xs">
                        {formatPrice(priceBounds.min, search.summary.currency)} –{' '}
                        {formatPrice(priceBounds.max, search.summary.currency)}
                      </p>
                    )}
                  </div>

                  <ProductGrid
                    products={displayedProducts}
                    bestDealId={search.best_deal?.product?.id ?? null}
                    emptyAction={
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                      >
                        <FilterIcon className="h-4 w-4" aria-hidden="true" />
                        Clear filters
                      </button>
                    }
                  />

                  {/* Load More Pagination */}
                  {visibleCount < filtered.length && (
                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                        className="btn-secondary btn-lg"
                      >
                        Load more products ({filtered.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </section>

                <PriceComparison sellers={search.sellers} currency={search.summary.currency} />

                {search.best_rated && search.best_rated.id !== search.best_deal?.product?.id && (
                  <section className="card p-6" aria-labelledby="best-rated-heading">
                    <h2 id="best-rated-heading" className="text-sm font-semibold">
                      Best rated in this search
                    </h2>
                    <p className="text-ink-600 mt-1 text-sm">
                      {search.best_rated.title} — {search.best_rated.rating?.toFixed(1)}★
                      {search.best_rated.reviews !== null && search.best_rated.reviews !== undefined
                        ? ` from ${search.best_rated.reviews.toLocaleString('en-IN')} reviews`
                        : ''}
                      {search.best_rated.source ? ` on ${search.best_rated.source}` : ''}
                      {search.best_rated.price_formatted ? ` · ${search.best_rated.price_formatted}` : ''}
                    </p>
                  </section>
                )}
              </>
            ) : (
              <ErrorState
                title="No matching products found"
                message={`We searched SerpApi for “${search.query}” but nothing came back. Try modifying your search.`}
                suggestions={[
                  'Shorten the query — brand and product type usually work best',
                  'Remove colour or size words that may be too specific',
                  'Check the spelling of the brand or model',
                ]}
                secondaryAction={
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleNewSearch}
                  >
                    Start a new search
                  </button>
                }
              />
            )}

            {/* Visual matches only when searching by image */}
            {isImageMode && <VisualMatches imageFile={flow.imageFile} />}

            <RefineSearch
              key={search.query}
              query={search.query}
              onRefine={handleSearch}
              loading={flow.isSearching}
              suggestions={refinements}
            />
          </>
        )}
      </div>
    </div>
  )
}
