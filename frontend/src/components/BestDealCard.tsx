import { ExternalLink, ImageOff, Info, Star, Trophy } from 'lucide-react'
import type { Recommendation } from '../types/product'
import { cx, formatCount, formatPrice } from '../lib/format'

interface BestDealCardProps {
  recommendation: Recommendation | null
  currency?: string
  className?: string
}

const CONFIDENCE_COPY: Record<Recommendation['confidence'], string> = {
  high: 'High confidence — plenty of priced and rated results',
  medium: 'Medium confidence — a handful of priced results',
  low: 'Low confidence — only a few usable data points',
}

export function BestDealCard({ recommendation, currency = 'INR', className }: BestDealCardProps) {
  const product = recommendation?.product ?? null

  if (!recommendation || !product) {
    return (
      <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="best-deal-heading">
        <h2 id="best-deal-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="text-ink-300 h-5 w-5" aria-hidden="true" />
          Best deal
        </h2>
        <p className="text-ink-500 mt-3 text-sm leading-relaxed">
          {recommendation?.explanation ??
            'Not enough comparable data to recommend a product for this search.'}
        </p>
      </section>
    )
  }

  const price = product.price_formatted ?? formatPrice(product.price, currency)
  const original =
    product.original_price_formatted ?? formatPrice(product.original_price, product.currency)

  return (
    <section
      className={cx(
        'animate-[var(--animate-fade-up)] overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      aria-labelledby="best-deal-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 px-6 py-4">
        <h2 id="best-deal-heading" className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden="true">🏆</span>
          {recommendation.headline}
        </h2>
        <span
          className={cx(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase',
            recommendation.confidence === 'high'
              ? 'bg-deal-100 text-deal-700'
              : recommendation.confidence === 'medium'
                ? 'bg-brand-50 text-brand-700'
                : 'bg-ink-100 text-ink-600',
          )}
        >
          {recommendation.confidence} confidence
        </span>
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="bg-ink-50 h-28 w-28 shrink-0 overflow-hidden rounded-xl">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              className="h-full w-full object-contain p-2"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-ink-300 flex h-full items-center justify-center">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-bold sm:text-xl">{product.title}</h3>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-2xl font-bold sm:text-3xl">{price}</span>
            {original && product.original_price !== null && (
              <span className="text-ink-400 text-sm line-through">{original}</span>
            )}
            {recommendation.savings_formatted && (
              <span className="bg-deal-100 text-deal-700 rounded-full px-2.5 py-1 text-xs font-semibold">
                Save {recommendation.savings_formatted} vs highest price
              </span>
            )}
          </div>

          <div className="text-ink-600 mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {product.source && <span className="font-medium">{product.source}</span>}
            {product.rating !== null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {product.rating.toFixed(1)}
              </span>
            )}
            {product.reviews !== null && <span>{formatCount(product.reviews)} reviews</span>}
            {recommendation.value_score !== null && (
              <span className="chip">Value score {Math.round(recommendation.value_score)}/100</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {product.link && (
              <a
                href={product.link}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-primary"
                aria-label={`View deal for ${product.title}`}
              >
                View Deal
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            {recommendation.alternatives.length > 0 && (
              <span className="text-ink-500 self-center text-xs">
                {recommendation.alternatives.length} runner-up
                {recommendation.alternatives.length > 1 ? 's' : ''} considered
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-amber-100 bg-white/70 px-6 py-4">
        <p className="text-ink-600 flex items-start gap-2 text-xs leading-relaxed">
          <Info className="text-ink-400 mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="text-ink-700 font-semibold">Best Value</strong> considers price,
            rating and available review information — 55% price, 30% rating, 15% review volume,
            re-weighted when a value is missing. {recommendation.explanation}{' '}
            {CONFIDENCE_COPY[recommendation.confidence]}.
          </span>
        </p>
      </div>
    </section>
  )
}
