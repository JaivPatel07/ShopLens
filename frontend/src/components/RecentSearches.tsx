import { Clock, History, RotateCw, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '../types/product'
import { cx, formatRelativeTime } from '../lib/format'
import { DemoBadge } from './DemoBadge'

interface RecentSearchesProps {
  history: HistoryEntry[]
  onRerun: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
  className?: string
}

/**
 * Recent searches stored in localStorage (metadata + a small thumbnail only).
 * Clicking an entry re-runs the same SerpApi search.
 */
export function RecentSearches({
  history,
  onRerun,
  onRemove,
  onClear,
  className,
}: RecentSearchesProps) {
  if (history.length === 0) return null

  return (
    <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="recent-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-heading" className="flex items-center gap-2 text-lg font-semibold">
          <History className="text-brand-500 h-4 w-4" aria-hidden="true" />
          Recent searches
        </h2>
        <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onClear}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear history
        </button>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="border-ink-100 hover:border-brand-200 hover:bg-brand-50/40 group flex items-center gap-3 rounded-2xl border p-3 transition"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => onRerun(entry)}
              aria-label={`Search again for ${entry.productName || entry.query}`}
            >
              <span className="bg-ink-50 h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                {entry.thumbnail ? (
                  <img
                    src={entry.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-ink-300 flex h-full items-center justify-center">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block truncate text-sm font-semibold">
                  {entry.productName || entry.query}
                </span>
                <span className="text-ink-500 block truncate text-xs">{entry.query}</span>
                <span className="text-ink-400 mt-0.5 flex items-center gap-2 text-xs">
                  {entry.lowestPriceFormatted && (
                    <span className="text-ink-700 font-medium">
                      from {entry.lowestPriceFormatted}
                    </span>
                  )}
                  <span>{formatRelativeTime(entry.timestamp)}</span>
                  {entry.isDemo && <DemoBadge label="Demo" />}
                </span>
              </span>

              <RotateCw
                className="text-ink-300 group-hover:text-brand-500 h-4 w-4 shrink-0 transition"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className="btn-ghost !px-2 !py-2"
              onClick={() => onRemove(entry.id)}
              aria-label={`Remove ${entry.productName || entry.query} from history`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
