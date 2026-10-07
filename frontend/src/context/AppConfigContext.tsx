import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import type { AppConfig } from '../types/product'

const FALLBACK_CONFIG: AppConfig = {
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

interface AppConfigValue {
  config: AppConfig
  /** True once /api/config answered (or failed) at least once. */
  ready: boolean
  /** True when the backend could not be reached at all. */
  offline: boolean
}

const AppConfigContext = createContext<AppConfigValue>({
  config: FALLBACK_CONFIG,
  ready: false,
  offline: false,
})

/** Loads the backend's public configuration so the UI can label demo data. */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(FALLBACK_CONFIG)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .config()
      .then((value) => {
        if (cancelled) return
        setConfig(value)
        setOffline(false)
      })
      .catch(() => {
        if (cancelled) return
        setOffline(true)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppConfigContext.Provider value={{ config, ready, offline }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig(): AppConfigValue {
  return useContext(AppConfigContext)
}
