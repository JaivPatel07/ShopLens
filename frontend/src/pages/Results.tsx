import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Filter as FilterIcon, Info, RefreshCw, Search } from 'lucide-react'
import { useProductFlow } from '../context/ProductFlowContext'
import { FilterBar } from '../components/FilterBar'
import { ProductGrid } from '../components/ProductGrid'
import { PriceComparison } from '../components/PriceComparison'
import { BestDealCard } from '../components/BestDealCard'
import { SearchSummary } from '../components/SearchSummary'
import { RefineSearch, buildRefinements } from '../components/RefineSearch'
import { ImagePreview } from '../components/ImagePreview'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { DemoBadge } from '../components/DemoBadge'
import type { FilterState } from '../types/product'
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

export default function Results() {
  const flow = useProductFlow()
  const navigate = useNavigate()
  const { addEntry } = useSearchHistory()
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const search = flow.search
  const products = search?.products ?? []

  // Reset filters whenever a new result set arrives.
  useEffect(() => {
    setFilters(DEFAULT_FILTERS)
  }, [search?.query, search?.created_at])

  const filtered = useMemo(
    () => applyFilters(products, filters, search?.best_deal?.product?.id ?? null),
    [products, filters, search?.best_deal?.product?.id],
  )

  const availableSellers = useMemo(() => deriveSellers(products), [products])

  const priceBounds = useMemo(() => derivePriceBounds(products), [products])

  const ratingBounds = useMemo(() => highestRating(products), [products])

  const refinements = useMemo(
    () => buildRefinements(search?.query ?? '', flow.analysis?.attributes ?? []),
    [search?.query, flow.analysis?.attributes],
  )

  const handleSearch = (query: string) => {
    void flow.runSearch(query).then(async (response) => {
      if (!response) return
      let thumbnail: string | null = null
      if (flow.imageFile) thumbnail = await createThumbnailDataUrl(flow.imageFile, 128)
      addEntry({
        productName: flow.analysis?.product_name ?? response.query,
        query: response.query,
        lowestPrice: response.summary.lowest_price,
        lowestPriceFormatted: response.summary.lowest_price_formatted ?? null,
        sellerCount: response.summary.seller_count,
        productCount: response.summary.count,
        thumbnail,
        isDemo: response.is_demo,
      })
    })
  }

  // -------------------------------------------------------------- empty state
  if (!search && !flow.isSearching) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
          <span className="bg-brand-50 text-brand-600 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <Search className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">No results to show yet</h1>
          <p className="text-ink-600 mt-3 text-sm leading-relaxed">
            Upload a product photo first — SnapBuy will identify it and run the price comparison for
            you.
          </p>
          <Link to="/#upload" className="btn-primary btn-lg mt-6">
            Upload a product photo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* ------------------------------------------------------ search header */}
      <header className="border-ink-100 bg-ink-50/40 border-b py-10">
        <div className="container-page">
          <Link
            to="/"
            className="text-ink-500 hover:text-ink-900 mb-6 inline-flex items-center gap-2 text-sm font-medium transition"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            New search
          </Link>

          <div className="grid gap-6 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
            {flow.imagePreview && (
              <ImagePreview
                src={flow.imagePreview}
                fileName={flow.imageFile?.name}
                onRemove={() => {
                  // "Start over": drop the image and the results, then go home.
                  flow.reset()
                  navigate('/#upload')
                }}
                compact
                className="max-w-[160px]"
              />
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="label">Results for</p>
                {search?.is_demo && <DemoBadge />}
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {flow.analysis?.product_name ?? search?.query ?? 'Your search'}
              </h1>

              <div className="text-ink-600 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {flow.isSearching ? (
                    'Searching…'
                  ) : (
                    <>
                      <strong className="text-ink-900 font-semibold">{search?.summary.count ?? 0}</strong>{' '}
                      products found
                    </>
                  )}
                </span>
                {search?.summary.seller_count ? (
                  <span>· {search.summary.seller_count} sellers</span>
                ) : null}
                {search?.elapsed_ms !== null && search?.elapsed_ms !== undefined && (
                  <span className="text-ink-400">· {(search.elapsed_ms / 1000).toFixed(1)}s</span>
                )}
                {search?.engine && !search.is_demo && (
                  <span className="chip">engine: {search.engine}</span>
                )}
              </div>

              {flow.analysis && (
                <p className="text-ink-500 mt-3 text-sm">
                  {[flow.analysis.brand, flow.analysis.category].filter(Boolean).join(' · ')}
                  {flow.analysis.description ? ` — ${flow.analysis.description}` : ''}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-ink-500 text-xs">
                  Query:{' '}
                  <span className="text-ink-800 font-medium">{search?.query ?? flow.searchQuery}</span>
                </p>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-xs"
                  onClick={() => handleSearch(search?.query ?? flow.searchQuery)}
                  disabled={flow.isSearching}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Refresh results
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page space-y-10 pt-10">
        {/* -------------------------------------------------------- error state */}
        {flow.searchStatus === 'error' && (
          <ErrorState
            title="Something went wrong while searching"
            message={flow.searchError ?? 'Please try again in a moment.'}
            suggestions={[
              'Check the generated search query and simplify it',
              'Try again — search providers occasionally rate-limit requests',
            ]}
            onRetry={() => handleSearch(search?.query ?? flow.searchQuery)}
            retryLabel="Search again"
          />
        )}

        {/* ------------------------------------------------------- loading state */}
        {flow.isSearching && (
          <>
            <LoadingState
              title="Finding matching products…"
              subtitle="SerpApi is searching Google Shopping and SnapBuy is comparing the results."
              stages={[
                { label: 'Image uploaded', done: Boolean(flow.imageFile) },
                { label: 'Identifying product', done: Boolean(flow.analysis) },
                { label: 'Finding matching products', done: false, active: true },
                { label: 'Comparing prices', done: false },
              ]}
            />
            <ProductGrid products={[]} loading skeletonCount={8} />
          </>
        )}

        {/* ------------------------------------------------------- result states */}
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
                    products={filtered}
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
                    onClick={() => navigate('/#upload')}
                  >
                    Try another image
                  </button>
                }
              />
            )}

            <RefineSearch
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
