import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'
import type { Product } from '../types/product'
import { ProductCard, ProductCardSkeleton } from './ProductCard'
import { cx } from '../lib/format'

interface ProductGridProps {
  products: Product[]
  loading?: boolean
  skeletonCount?: number
  /** Product id picked by the recommendation engine. */
  bestDealId?: string | null
  emptyAction?: ReactNode
  className?: string
}

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export function ProductGrid({
  products,
  loading = false,
  skeletonCount = 8,
  bestDealId,
  emptyAction,
  className,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={cx(GRID, className)} aria-busy="true" aria-label="Loading products">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ProductCardSkeleton key={index} index={index} />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className={cx('card flex flex-col items-center px-6 py-14 text-center', className)}>
        <span className="bg-ink-50 text-ink-400 flex h-12 w-12 items-center justify-center rounded-2xl">
          <PackageSearch className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-semibold">No products match these filters</h3>
        <p className="text-ink-500 mt-1 max-w-sm text-sm">
          Try widening the price range, clearing the rating filter, or searching with a different
          query.
        </p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    )
  }

  return (
    <div className={cx(GRID, className)}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          index={index}
          highlight={product.id === bestDealId}
          badge={product.id === bestDealId ? 'Best value' : undefined}
        />
      ))}
    </div>
  )
}
