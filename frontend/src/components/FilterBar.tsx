import { useMemo, useState } from 'react'
import { Check, RotateCcw, SlidersHorizontal, Star, X } from 'lucide-react'
import type { FilterState, SortOption } from '../types/product'
import { cx, formatPrice } from '../lib/format'
import { DEFAULT_FILTERS } from '../lib/filters'
import { useMediaQuery } from '../hooks/useMediaQuery'

interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  availableSellers: string[]
  priceBounds: { min: number; max: number } | null
  ratingBounds: number | null
  totalCount: number
  shownCount: number
  currency?: string
  className?: string
}

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'best_match', label: 'Best Match' },
  { value: 'lowest_price', label: 'Lowest Price' },
  { value: 'highest_price', label: 'Highest Price' },
  { value: 'highest_rating', label: 'Highest Rating' },
]

const RATING_OPTIONS = [4.5, 4, 3.5, 3]

export function FilterBar({
  filters,
  onChange,
  availableSellers,
  priceBounds,
  ratingBounds,
  totalCount,
  shownCount,
  currency = 'INR',
  className,
}: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const drawerVisible = drawerOpen && !isDesktop

  const activeCount = useMemo(() => {
    let count = 0
    if (filters.minPrice !== null || filters.maxPrice !== null) count += 1
    if (filters.minRating !== null) count += 1
    if (filters.sellers.length > 0) count += 1
    if (filters.sort !== 'best_match') count += 1
    return count
  }, [filters])

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const clear = () => onChange({ ...DEFAULT_FILTERS })

  const controls = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor="sort-select" className="label mb-2 block">
          Sort by
        </label>
        <select
          id="sort-select"
          className="field"
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value as SortOption })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="label mb-2 block">Price range</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={priceBounds ? `${Math.floor(priceBounds.min)}` : 'Min'}
            aria-label="Minimum price"
            className="field"
            value={filters.minPrice ?? ''}
            onChange={(event) =>
              update({ minPrice: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
          <span className="text-ink-400">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={priceBounds ? `${Math.ceil(priceBounds.max)}` : 'Max'}
            aria-label="Maximum price"
            className="field"
            value={filters.maxPrice ?? ''}
            onChange={(event) =>
              update({ maxPrice: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        </div>
      </div>

      <div>
        <label htmlFor="rating-select" className="label mb-2 block">
          Minimum rating
        </label>
        <select
          id="rating-select"
          className="field"
          value={filters.minRating ?? ''}
          disabled={ratingBounds === null}
          onChange={(event) =>
            update({ minRating: event.target.value === '' ? null : Number(event.target.value) })
          }
        >
          <option value="">Any rating</option>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating.toFixed(1)} and above
            </option>
          ))}
        </select>
        {ratingBounds === null && (
          <p className="text-ink-400 mt-1.5 text-xs">No ratings in these results</p>
        )}
      </div>

      <div>
        <span className="label mb-2 block">Seller</span>
        {availableSellers.length === 0 ? (
          <p className="text-ink-400 text-xs">No seller information returned</p>
        ) : (
          <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {availableSellers.map((seller) => {
              const selected = filters.sellers.includes(seller)
              return (
                <li key={seller}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      update({
                        sellers: selected
                          ? filters.sellers.filter((item) => item !== seller)
                          : [...filters.sellers, seller],
                      })
                    }
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                      selected
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50 bg-white',
                    )}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    {seller}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <section className={cx('card p-4 sm:p-5', className)} aria-label="Filter and sort results">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-600 text-sm">
          Showing <strong className="text-ink-900 font-semibold">{shownCount}</strong> of{' '}
          <strong className="text-ink-900 font-semibold">{totalCount}</strong> products
          {filters.sellers.length > 0 && ' · seller filter on'}
        </p>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="btn-ghost !px-2.5 !py-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Clear ({activeCount})
            </button>
          )}
          <button
            type="button"
            className="btn-secondary lg:hidden"
            aria-expanded={drawerVisible}
            aria-controls="filter-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>

      <div className="mt-5 hidden lg:block">{controls}</div>

      {drawerVisible && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-ink-900/40 backdrop-blur-sm"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="filter-drawer"
            className="animate-[var(--animate-fade-up)] absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters &amp; sorting</h2>
              <button
                type="button"
                className="btn-ghost !px-2 !py-1"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">{controls}</div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  clear()
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => setDrawerOpen(false)}
              >
                Show {shownCount} products
              </button>
            </div>

            {priceBounds && (
              <p className="text-ink-400 mt-4 flex items-center gap-1.5 text-xs">
                <Star className="h-3 w-3" aria-hidden="true" />
                Prices in this result set range from{' '}
                {formatPrice(priceBounds.min, currency)} to {formatPrice(priceBounds.max, currency)}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
