import { describe, expect, it } from 'vitest'
import { applyFilters, availableSellers, DEFAULT_FILTERS, highestRating, priceBounds } from '../lib/filters'
import { formatCount, formatPrice, percentOff } from '../lib/format'
import { makeProduct } from './factories'

const products = [
  makeProduct({ id: 'a', title: 'Cheap one', price: 1000, rating: 3.8, reviews: 10, source: 'Amazon', position: 1 }),
  makeProduct({ id: 'b', title: 'Mid one', price: 2500, rating: 4.6, reviews: 900, source: 'Myntra', position: 2 }),
  makeProduct({ id: 'c', title: 'Pricey one', price: 5000, rating: 4.2, reviews: 50, source: 'Flipkart', position: 3 }),
  makeProduct({ id: 'd', title: 'No price', price: null, rating: null, source: null, position: 4 }),
]

describe('applyFilters', () => {
  it('sorts by lowest price and pushes unpriced items last', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, sort: 'lowest_price' })
    expect(result.map((product) => product.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sorts by highest price', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, sort: 'highest_price' })
    expect(result[0].id).toBe('c')
    expect(result.at(-1)?.id).toBe('d')
  })

  it('sorts by rating and breaks ties with review count', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, sort: 'highest_rating' })
    expect(result.map((product) => product.id).slice(0, 3)).toEqual(['b', 'c', 'a'])
  })

  it('keeps the recommended product first in best_match', () => {
    const result = applyFilters(products, DEFAULT_FILTERS, 'c')
    expect(result[0].id).toBe('c')
  })

  it('filters by price range', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, minPrice: 1500, maxPrice: 3000 })
    expect(result.map((product) => product.id)).toEqual(['b'])
  })

  it('filters by minimum rating, excluding unrated products', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, minRating: 4.4 })
    expect(result.map((product) => product.id)).toEqual(['b'])
  })

  it('filters by seller', () => {
    const result = applyFilters(products, { ...DEFAULT_FILTERS, sellers: ['Amazon', 'Flipkart'] })
    expect(result.map((product) => product.id)).toEqual(['a', 'c'])
  })

  it('never mutates the input array', () => {
    const original = [...products]
    applyFilters(products, { ...DEFAULT_FILTERS, sort: 'lowest_price' })
    expect(products).toEqual(original)
  })
})

describe('derived filter options', () => {
  it('lists unique sellers sorted alphabetically', () => {
    expect(availableSellers(products)).toEqual(['Amazon', 'Flipkart', 'Myntra'])
  })

  it('computes price bounds from valid prices only', () => {
    expect(priceBounds(products)).toEqual({ min: 1000, max: 5000 })
    expect(priceBounds([makeProduct({ price: null })])).toBeNull()
  })

  it('returns the highest rating or null', () => {
    expect(highestRating(products)).toBe(4.6)
    expect(highestRating([makeProduct({ rating: null })])).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('formats INR prices with Indian grouping', () => {
    expect(formatPrice(8499, 'INR')).toBe('₹8,499')
    expect(formatPrice(149990, 'INR')).toBe('₹1,49,990')
    expect(formatPrice(null, 'INR')).toBe('—')
  })

  it('formats other currencies', () => {
    expect(formatPrice(1299, 'USD')).toBe('$1,299')
  })

  it('compacts review counts', () => {
    expect(formatCount(940)).toBe('940')
    expect(formatCount(1234)).toBe('1.2k')
    expect(formatCount(8642)).toBe('8.6k')
    expect(formatCount(2_400_000)).toBe('2.4M')
  })

  it('only reports a discount when the original price is higher', () => {
    expect(percentOff(8499, 9999)).toBe(15)
    expect(percentOff(9999, 8499)).toBeNull()
    expect(percentOff(null, 9999)).toBeNull()
  })
})
