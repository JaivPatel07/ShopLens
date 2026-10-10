import { createContext, useContext } from 'react'
import type { AppConfig } from '../types/product'

export interface AppConfigValue {
  config: AppConfig
  ready: boolean
  offline: boolean
}

export const FALLBACK_CONFIG: AppConfig = {
  app_name: 'ShopLens API',
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

export const AppConfigContext = createContext<AppConfigValue>({
  config: FALLBACK_CONFIG,
  ready: false,
  offline: false,
})

export function useAppConfig(): AppConfigValue {
  return useContext(AppConfigContext)
}
