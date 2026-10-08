import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import type { AppConfig } from '../types/product'
import { AppConfigContext, FALLBACK_CONFIG } from './appConfig'

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
