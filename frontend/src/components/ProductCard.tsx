import { useState } from 'react'
import { ExternalLink, ImageOff, Star, TrendingDown } from 'lucide-react'
import type { Product } from '../types/product'
import { cx, formatCount, formatPrice, percentOff } from '../lib/format'
import { DemoBadge } from './DemoBadge'

interface ProductCardProps {
  product: Product
  /** Highlights the card picked by the recommendation engine. */
  highlight?: boolean
  badge?: string
  index?: number
}

export function ProductCard({ product, highlight = false, badge, index = 0 }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  const discount =
    product.discount_percent ?? percentOff(product.price, product.original_price) ?? null
  const price = product.price_formatted ?? formatPrice(product.price, product.currency)
  const original = product.original_price_formatted ?? formatPrice(product.original_price, product.currency)

  return (
    <article
      className={cx(
        'card card-hover animate-[var(--animate-fade-up)] flex h-full flex-col overflow-hidden',
        highlight && 'ring-brand-200 ring-2',
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="bg-ink-50 relative aspect-square w-full overflow-hidden">
        {product.thumbnail && !imageFailed ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-3 transition duration-500 hover:scale-[1.03]"
          />
        ) : (
          <div
            className="text-ink-300 flex h-full w-full flex-col items-center justify-center gap-2"
            role="img"
            aria-label={`No image available for ${product.title}`}
          >
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs">No image</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
          {badge && (
            <span className="bg-ink-900/90 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
              {badge}
            </span>
          )}
          {product.is_demo && <DemoBadge label="Demo" />}
        </div>

        {discount !== null && discount > 0 && (
          <span className="bg-deal-600 absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
            {Math.round(discount)}% OFF
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-ink-900 line-clamp-2 text-sm leading-snug font-semibold" title={product.title}>
          {product.title}
        </h3>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-ink-900 text-xl font-bold">{price}</span>
          {original && product.original_price !== null && (
            <span className="text-ink-400 text-sm line-through">{original}</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {product.rating !== null ? (
            <span className="text-ink-700 inline-flex items-center gap-1 font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {product.rating.toFixed(1)}
              {product.reviews !== null && (
                <span className="text-ink-400">({formatCount(product.reviews)})</span>
              )}
            </span>
          ) : (
            <span className="text-ink-400">No rating yet</span>
          )}
          {product.value_score !== null && (
            <span
              className="text-brand-600 bg-brand-50 rounded-full px-2 py-0.5 font-semibold"
              title="SnapBuy value score: 55% price, 30% rating, 15% review volume."
            >
              Value {Math.round(product.value_score)}
            </span>
          )}
        </div>

        {product.delivery && (
          <p className="text-ink-500 mt-2 line-clamp-1 text-xs">{product.delivery}</p>
        )}

        <div className="mt-auto pt-4">
          <p className="text-ink-500 mb-3 flex items-center gap-1.5 text-xs font-medium">
            <span className="bg-ink-100 inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-ink-600 uppercase">
              {(product.source ?? 'Shop').slice(0, 2)}
            </span>
            {product.source ?? 'Unknown seller'}
          </p>

          {product.link ? (
            <a
              href={product.link}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary w-full"
              aria-label={`View deal for ${product.title}${product.source ? ` at ${product.source}` : ''}`}
            >
              View Deal
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="btn-secondary w-full cursor-not-allowed opacity-70">Link unavailable</span>
          )}
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="card overflow-hidden" style={{ animationDelay: `${index * 40}ms` }} aria-hidden="true">
      <div className="skeleton aspect-square w-full" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3.5 w-4/5" />
        <div className="skeleton h-3.5 w-3/5" />
        <div className="skeleton h-6 w-1/3" />
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-9 w-full rounded-xl" />
      </div>
    </div>
  )
}
