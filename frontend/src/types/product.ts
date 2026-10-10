
export interface Product {
  id: string
  title: string
  price: number | null
  currency: string
  price_formatted: string | null
  original_price: number | null
  original_price_formatted: string | null
  discount_percent: number | null
  source: string | null
  rating: number | null
  reviews: number | null
  thumbnail: string | null
  link: string | null
  position: number
  snippet: string | null
  delivery: string | null
  extensions: string[]
  value_score: number | null
  visual_similarity_score: number | null
  ranking_score: number | null
  is_demo: boolean
}

export interface PriceSummary {
  count: number
  priced_count: number
  lowest_price: number | null
  highest_price: number | null
  average_price: number | null
  median_price: number | null
  currency: string
  lowest_price_formatted: string | null
  highest_price_formatted: string | null
  average_price_formatted: string | null
  median_price_formatted: string | null
  potential_saving: number | null
  potential_saving_formatted: string | null
  seller_count: number
  rated_count: number
}

export type SearchMode = 'text' | 'image'

export interface SellerOffer {
  source: string
  price: number
  currency: string
  price_formatted: string | null
  title: string | null
  link: string | null
  rating: number | null
  reviews: number | null
  is_lowest: boolean
  delta_from_lowest: number | null
  delta_from_lowest_formatted: string | null
  variant?: string | null
  condition?: string | null
}

export type RecommendationReason =
  | 'best_value'
  | 'lowest_price'
  | 'best_rating'
  | 'insufficient_data'

export interface Recommendation {
  product: Product | null
  reason: RecommendationReason
  headline: string
  explanation: string
  savings: number | null
  savings_formatted: string | null
  value_score: number | null
  confidence: 'high' | 'medium' | 'low'
  alternatives: Product[]
}

export interface SearchResponse {
  query: string
  engine: string
  search_mode?: string
  products: Product[]
  summary: PriceSummary
  sellers: SellerOffer[]
  best_deal: Recommendation | null
  best_rated: Product | null
  is_demo: boolean
  notes: string[]
  created_at: string
  elapsed_ms: number | null
}

export interface VisualMatch {
  id: string
  title: string
  source: string | null
  link: string | null
  thumbnail: string | null
  price: number | null
  currency: string
  price_formatted: string | null
  rating: number | null
  reviews: number | null
  in_stock: boolean | null
  is_demo: boolean
}

export interface VisualSimilarResponse {
  matches: VisualMatch[]
  engine: string
  count: number
  is_demo: boolean
  notes: string[]
}

export interface VisionAttributes {
  product_name: string
  brand: string | null
  category: string | null
  description: string | null
  search_query: string
  attributes: string[]
  confidence: number | null
  detected: boolean
  provider: string
  is_demo: boolean
  notes: string[]
  detection_debug: { label: string; score: number }[]
}

export interface AppConfig {
  app_name: string
  version: string
  demo_mode: 'auto' | 'on' | 'off'
  demo_vision: boolean
  demo_search: boolean
  serpapi_configured: boolean
  vision_provider: string
  vision_configured: boolean
  currency: string
  market: string
  supported_image_types: string[]
  max_upload_mb: number
}

export interface ApiErrorPayload {
  error?: {
    code?: string
    message?: string
  }
}

export type SortOption = 'best_match' | 'lowest_price' | 'highest_price' | 'highest_rating'

export interface FilterState {
  sort: SortOption
  minPrice: number | null
  maxPrice: number | null
  minRating: number | null
  sellers: string[]
}

export interface HistoryEntry {
  id: string
  productName: string
  query: string
  timestamp: number
  lowestPrice: number | null
  lowestPriceFormatted: string | null
  sellerCount: number
  productCount: number
  thumbnail: string | null
  isDemo: boolean
}

export type FlowStatus = 'idle' | 'loading' | 'success' | 'error'
