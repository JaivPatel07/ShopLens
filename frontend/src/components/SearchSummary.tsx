import { ArrowDown, ArrowUp, Minus, TrendingDown } from 'lucide-react'
import type { PriceSummary as PriceSummaryType } from '../types/product'
import { cx, formatPrice } from '../lib/format'

interface SearchSummaryProps {
  summary: PriceSummaryType
  loading?: boolean
  className?: string
}

export function SearchSummary({ summary, loading = false, className }: SearchSummaryProps) {
  const cards = [
    {
      key: 'lowest',
      label: 'Lowest price',
      value: summary.lowest_price_formatted ?? formatPrice(summary.lowest_price, summary.currency),
      icon: ArrowDown,
      tone: 'text-deal-600 bg-deal-50',
      hint: summary.seller_count > 0 ? `Across ${summary.seller_count} seller${summary.seller_count === 1 ? '' : 's'}` : 'Best of the results',
    },
    {
      key: 'average',
      label: 'Average price',
      value: summary.average_price_formatted ?? formatPrice(summary.average_price, summary.currency),
      icon: Minus,
      tone: 'text-brand-600 bg-brand-50',
      hint: summary.median_price
        ? `Median ${summary.median_price_formatted ?? formatPrice(summary.median_price, summary.currency)}`
        : `From ${summary.priced_count} priced result${summary.priced_count === 1 ? '' : 's'}`,
    },
    {
      key: 'highest',
      label: 'Highest price',
      value: summary.highest_price_formatted ?? formatPrice(summary.highest_price, summary.currency),
      icon: ArrowUp,
      tone: 'text-ink-600 bg-ink-100',
      hint: 'Most expensive listing found',
    },
  ]

  return (
    <section className={className} aria-labelledby="price-summary-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="price-summary-heading" className="text-lg font-semibold sm:text-xl">
          Price Summary
        </h2>
        {summary.potential_saving_formatted && (
          <p className="text-deal-700 bg-deal-50 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            Up to {summary.potential_saving_formatted} between the cheapest and the highest listing
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {cards.map((card, index) => (
          <div
            key={card.key}
            className="card card-hover animate-[var(--animate-fade-up)] p-5"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <p className="label">{card.label}</p>
              <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', card.tone)}>
                <card.icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p
              className={cx('mt-3 font-mono text-2xl font-bold sm:text-3xl', loading && 'text-ink-300')}
              aria-live="polite"
            >
              {loading ? '—' : card.value ?? '—'}
            </p>
            <p className="text-ink-500 mt-1 text-xs">{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
