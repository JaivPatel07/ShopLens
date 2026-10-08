import type { FilterState, Product, SortOption } from '../types/product'

export const DEFAULT_FILTERS: FilterState = {
  sort: 'best_match',
  minPrice: null,
  maxPrice: null,
  minRating: null,
  sellers: [],
}

const SORTERS: Record<SortOption, (a: Product, b: Product, bestDealId: string | null) => number> = {
  best_match: (a, b, bestDealId) => {
    if (a.id === bestDealId) return -1
    if (b.id === bestDealId) return 1
    return a.position - b.position
  },
  lowest_price: (a, b) =>
    (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY),
  highest_price: (a, b) => (b.price ?? -1) - (a.price ?? -1),
  highest_rating: (a, b) =>
    (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0),
}

export function applyFilters(
  products: Product[],
  filters: FilterState,
  bestDealId: string | null = null,
): Product[] {
  const filtered = products.filter((product) => {
    if (filters.minPrice !== null && (product.price ?? 0) < filters.minPrice) return false
    if (filters.maxPrice !== null) {
      if (product.price === null || product.price > filters.maxPrice) return false
    }
    if (filters.minRating !== null) {
      if (product.rating === null || product.rating < filters.minRating) return false
    }
    if (filters.sellers.length > 0) {
      if (!product.source || !filters.sellers.includes(product.source)) return false
    }
    return true
  })

  return [...filtered].sort((a, b) => SORTERS[filters.sort](a, b, bestDealId))
}

export function availableSellers(products: Product[]): string[] {
  const sellers = new Set(
    products.map((product) => product.source).filter((value): value is string => Boolean(value)),
  )
  return [...sellers].sort((a, b) => a.localeCompare(b))
}

export function priceBounds(products: Product[]): { min: number; max: number } | null {
  const prices = products
    .map((product) => product.price)
    .filter((value): value is number => value !== null && value > 0)
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export function highestRating(products: Product[]): number | null {
  const ratings = products
    .map((product) => product.rating)
    .filter((value): value is number => value !== null)
  return ratings.length === 0 ? null : Math.max(...ratings)
}
