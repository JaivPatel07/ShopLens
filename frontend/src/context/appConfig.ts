import { createContext, useContext } from 'react'
import type { AppConfig } from '../types/product'

export interface AppConfigValue {
  config: AppConfig
  /** True once /api/config answered (or failed) at least once. */
  ready: boolean
  /** True when the backend could not be reached at all. */
  offline: boolean
}

export const FALLBACK_CONFIG: AppConfig = {
  app_name: 'SnapBuy API',
  version: '1.0.0',
  demo_mode: 'auto',
  demo_vision: false,
  demo_search: false,
  serpapi_configured: false,
  vision_provider: 'unknown',
  vision_configured: false,
  currency: 'INR',
  market: 'India',
  supported_image_types: ['JPG', 'JPEG', 'PNG', 'WEBP'],
  max_upload_mb: 10,
}

/** Context object + hook kept out of the component file for Fast Refresh. */
export const AppConfigContext = createContext<AppConfigValue>({
  config: FALLBACK_CONFIG,
  ready: false,
  offline: false,
})

/** Read the backend's public (non-secret) runtime configuration. */
export function useAppConfig(): AppConfigValue {
  return useContext(AppConfigContext)
}
