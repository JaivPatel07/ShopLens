import { ExternalLink, Star, Trophy } from 'lucide-react'
import type { SellerOffer } from '../types/product'
import { cx, formatPrice } from '../lib/format'

interface PriceComparisonProps {
  sellers: SellerOffer[]
  currency?: string
  className?: string
}

export function PriceComparison({ sellers, currency = 'INR', className }: PriceComparisonProps) {
  if (sellers.length === 0) return null

  // Filter for valid positive prices and sort ascending
  const validSellers = [...sellers]
    .filter((s) => typeof s.price === 'number' && s.price > 0)
    .sort((a, b) => a.price - b.price)

  if (validSellers.length === 0) {
    return (
      <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="price-comparison-heading">
        <h2 id="price-comparison-heading" className="text-lg font-semibold sm:text-xl">
          Price Comparison
        </h2>
        <p className="text-ink-500 mt-2 text-sm">
          No merchant pricing comparisons available for this query.
        </p>
      </section>
    )
  }

  const prices = validSellers.map((seller) => seller.price)
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  const span = Math.max(highest - lowest, 0)

  return (
    <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="price-comparison-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="price-comparison-heading" className="text-lg font-semibold sm:text-xl">
            Price Comparison by Seller
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Cheapest comparable offer per merchant for this product.
          </p>
        </div>
        {span > 0 && (
          <p className="text-ink-500 text-xs font-medium">
            Spread of {formatPrice(span, currency)} between lowest and highest seller
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-4">
        {validSellers.map((seller) => {
          const ratio = span === 0 ? 1 : (seller.price - lowest) / span
          const width = 45 + ratio * 55

          return (
            <li
              key={`${seller.source}-${seller.price}`}
              className="group flex flex-col gap-2 rounded-xl p-2.5 transition-colors duration-200 hover:bg-ink-50/70 sm:grid sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  {seller.is_lowest && (
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Lowest price" />
                  )}
                  <span className="text-ink-900 truncate text-sm font-semibold" title={seller.source}>
                    {seller.source}
                  </span>
                  {seller.link && (
                    <a
                      href={seller.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-400 hover:text-brand-600 transition"
                      aria-label={`Visit ${seller.source}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Variant or condition tags if available */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {seller.variant && (
                    <span className="bg-ink-100 text-ink-700 rounded px-1.5 py-0.5 font-medium">
                      {seller.variant}
                    </span>
                  )}
                  {seller.condition && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200/60 rounded px-1.5 py-0.5 font-medium">
                      {seller.condition}
                    </span>
                  )}
                  {seller.rating && (
                    <span className="text-ink-500 flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      {seller.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-ink-100 relative h-2.5 w-full overflow-hidden rounded-full">
                <div
                  className={cx(
                    'h-full rounded-full transition-all duration-700',
                    seller.is_lowest
                      ? 'from-deal-500 to-deal-600 bg-gradient-to-r'
                      : 'from-brand-500 to-accent-500 bg-gradient-to-r',
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-ink-900 font-mono text-sm font-bold">
                  {seller.price_formatted ?? formatPrice(seller.price, currency)}
                </span>
                {seller.delta_from_lowest_formatted ? (
                  <span className="text-ink-400 w-16 text-right text-xs">
                    +{seller.delta_from_lowest_formatted}
                  </span>
                ) : (
                  <span className="text-deal-700 bg-deal-50 border border-deal-200/50 rounded px-1.5 py-0.5 text-xs font-semibold">
                    Lowest
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <details className="group mt-6">
        <summary className="text-ink-500 hover:text-ink-900 cursor-pointer text-xs font-medium">
          How prices are calculated
        </summary>
        <p className="text-ink-500 mt-2 text-xs leading-relaxed">
          Each row displays the best verified price received for that seller. Variants, conditions,
          and storage sizes are distinguished when specified by the merchant. Bar length illustrates the price spread
          across comparable retailers.
        </p>
      </details>
    </section>
  )
}
