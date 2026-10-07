import type { Product, SearchResponse, VisionAttributes } from '../types/product'

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270',
    price: 8499,
    currency: 'INR',
    price_formatted: '₹8,499',
    original_price: 9999,
    original_price_formatted: '₹9,999',
    discount_percent: 15,
    source: 'Myntra',
    rating: 4.6,
    reviews: 1234,
    thumbnail: 'https://example.com/thumb.jpg',
    link: 'https://example.com/product',
    position: 1,
    snippet: null,
    delivery: null,
    extensions: [],
    value_score: 80,
    is_demo: false,
    ...overrides,
  }
}

export function makeSearchResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  const products = overrides.products ?? [makeProduct()]
  return {
    query: 'nike air max 270',
    engine: 'google_shopping',
    products,
    summary: {
      count: products.length,
      priced_count: products.filter((product) => product.price !== null).length,
      lowest_price: 8499,
      highest_price: 9999,
      average_price: 9161.75,
      median_price: 9074.5,
      currency: 'INR',
      lowest_price_formatted: '₹8,499',
      highest_price_formatted: '₹9,999',
      average_price_formatted: '₹9,161.75',
      median_price_formatted: '₹9,074.50',
      potential_saving: 1500,
      potential_saving_formatted: '₹1,500',
      seller_count: 2,
      rated_count: 2,
    },
    sellers: [
      {
        source: 'Myntra',
        price: 8499,
        currency: 'INR',
        price_formatted: '₹8,499',
        title: products[0]?.title ?? null,
        link: products[0]?.link ?? null,
        rating: 4.6,
        reviews: 1234,
        is_lowest: true,
        delta_from_lowest: 0,
        delta_from_lowest_formatted: null,
      },
    ],
    best_deal: null,
    best_rated: products[0] ?? null,
    is_demo: false,
    notes: [],
    created_at: new Date().toISOString(),
    elapsed_ms: 812,
    ...overrides,
  }
}

export function makeAnalysis(overrides: Partial<VisionAttributes> = {}): VisionAttributes {
  return {
    product_name: 'Nike Air Max 270',
    brand: 'Nike',
    category: 'Running shoes',
    description: 'Black athletic sneaker with white midsole.',
    search_query: "Nike Air Max 270 black men's shoes",
    attributes: ['black', 'athletic', 'Nike'],
    confidence: 0.72,
    detected: true,
    provider: 'demo',
    is_demo: false,
    notes: [],
    ...overrides,
  }
}

/** A tiny valid PNG file usable in upload tests. */
export function makeImageFile(name = 'product.png', type = 'image/png'): File {
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89,
  ])
  return new File([png], name, { type })
}
