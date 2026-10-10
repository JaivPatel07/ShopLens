import { useCallback, useEffect, useState } from 'react'
import type { HistoryEntry } from '../types/product'

const STORAGE_KEY = 'shoplens.history.v1'
const MAX_ENTRIES = 12

function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is HistoryEntry => {
        if (!entry || typeof entry !== 'object') return false
        const candidate = entry as Partial<HistoryEntry>
        return typeof candidate.query === 'string' && typeof candidate.timestamp === 'number'
      })
      .slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    typeof window === 'undefined' ? [] : readHistory(),
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setHistory(readHistory())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const persist = useCallback((entries: HistoryEntry[]) => {
    setHistory(entries)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(entries.map((entry) => ({ ...entry, thumbnail: null }))),
        )
      } catch {
      }
    }
  }, [])

  const addEntry = useCallback(
    (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
      setHistory((current) => {
        const deduped = current.filter(
          (item) => item.query.toLowerCase() !== entry.query.toLowerCase(),
        )
        const next: HistoryEntry[] = [
          { ...entry, id: crypto.randomUUID?.() ?? `${Date.now()}`, timestamp: Date.now() },
          ...deduped,
        ].slice(0, MAX_ENTRIES)
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          try {
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(next.map((item) => ({ ...item, thumbnail: null }))),
            )
          } catch {
          }
        }
        return next
      })
    },
    [],
  )

  const removeEntry = useCallback(
    (id: string) => persist(readHistory().filter((entry) => entry.id !== id)),
    [persist],
  )

  const clearHistory = useCallback(() => persist([]), [persist])

  return { history, addEntry, removeEntry, clearHistory }
}
