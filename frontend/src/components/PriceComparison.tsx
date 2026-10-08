import { Trophy } from 'lucide-react'
import type { SellerOffer } from '../types/product'
import { cx, formatPrice } from '../lib/format'

interface PriceComparisonProps {
  sellers: SellerOffer[]
  currency?: string
  className?: string
}

export function PriceComparison({ sellers, currency = 'INR', className }: PriceComparisonProps) {
  if (sellers.length === 0) return null

  const prices = sellers.map((seller) => seller.price)
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  const span = Math.max(highest - lowest, 0)

  return (
    <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="price-comparison-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="price-comparison-heading" className="text-lg font-semibold sm:text-xl">
            Price Comparison
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Cheapest offer per seller, from the results returned for this query.
          </p>
        </div>
        {span > 0 && (
          <p className="text-ink-500 text-xs">
            Spread of {formatPrice(span, currency)} between the cheapest and the highest seller
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-3.5">
        {sellers.map((seller) => {
          const ratio = span === 0 ? 1 : (seller.price - lowest) / span
          const width = 45 + ratio * 55

          return (
            <li key={seller.source} className="group grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 rounded-lg px-2 transition-colors duration-200 hover:bg-ink-50/70 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
              <span className="text-ink-800 flex min-w-0 items-center gap-1.5 text-sm font-medium">
                {seller.is_lowest && (
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Lowest price" />
                )}
                <span className="truncate" title={seller.source}>
                  {seller.source}
                </span>
              </span>

              <span className="bg-ink-100 relative block h-2.5 overflow-hidden rounded-full">
                <span
                  className={cx(
                    'block h-full rounded-full transition-all duration-700',
                    seller.is_lowest
                      ? 'from-deal-500 to-deal-600 bg-gradient-to-r'
                      : 'from-brand-500 to-accent-500 bg-gradient-to-r',
                  )}
                  style={{ width: `${width}%` }}
                />
              </span>

              <span className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                <span className="text-ink-900 font-mono text-sm font-semibold">
                  {seller.price_formatted ?? formatPrice(seller.price, currency)}
                </span>
                {seller.delta_from_lowest_formatted ? (
                  <span className="text-ink-400 w-16 text-right text-xs">
                    +{seller.delta_from_lowest_formatted}
                  </span>
                ) : (
                  <span className="text-deal-700 w-16 text-right text-xs font-medium">lowest</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <details className="group mt-6">
        <summary className="text-ink-500 hover:text-ink-900 cursor-pointer text-xs font-medium">
          How this is calculated
        </summary>
        <p className="text-ink-500 mt-2 text-xs leading-relaxed">
          Each bar shows the cheapest offer SnapBuy received for that seller in the current result
          set. Bar length is scaled between the lowest and the highest price, so a longer bar simply
          means a higher price. Prices come from live search data and can change on the seller&apos;s
          site.
        </p>
      </details>

    </section>
  )
}
