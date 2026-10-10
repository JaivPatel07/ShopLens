import { useEffect, useState } from 'react'
import {
  Camera,
  ExternalLink,
  ImageOff,
  Loader2,
  ScanSearch,
  Search,
  Star,
  X,
} from 'lucide-react'
import type { VisualMatch } from '../types/product'
import { api } from '../services/api'
import { cx } from '../lib/format'
import { DemoBadge } from './DemoBadge'

type VisualState = 'idle' | 'loading' | 'ready' | 'error'

interface LensResult {
  file: File
  matches: VisualMatch[]
  isDemo: boolean
  failed: boolean
}

export function VisualMatches({
  imageFile,
  className,
  onMatchesLoaded,
  onSuggestQuery,
  onSearchMatch,
}: {
  imageFile: File | null
  className?: string
  /** Notified once with the full matches array when Lens results land. */
  onMatchesLoaded?: (matches: VisualMatch[]) => void
  /** Notified when the user clicks "Use as query" on a match card. */
  onSuggestQuery?: (query: string) => void
  /** Directly trigger search with this match title. */
  onSearchMatch?: (query: string) => void
}) {
  const [result, setResult] = useState<LensResult | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!imageFile) return
    let cancelled = false
    api
      .visualSimilar(imageFile)
      .then((response) => {
        if (cancelled) return
        setResult({
          file: imageFile,
          matches: response.matches,
          isDemo: response.is_demo,
          failed: false,
        })
        onMatchesLoaded?.(response.matches)
      })
      .catch(() => {
        if (cancelled) return
        setResult({ file: imageFile, matches: [], isDemo: false, failed: true })
        onMatchesLoaded?.([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile])

  if (!imageFile || dismissed) return null

  const current = result?.file === imageFile ? result : null
  const state: VisualState = current
    ? current.failed
      ? 'error'
      : 'ready'
    : 'loading'
  const matches = current?.matches ?? []
  const isDemo = current?.isDemo ?? false

  return (
    <section
      id="google-lens-matches"
      className={cx(
        'card p-6 sm:p-8 animate-[var(--animate-fade-up)] border border-purple-200/80 bg-gradient-to-b from-white via-white to-purple-50/20 shadow-[var(--shadow-card)]',
        className,
      )}
      aria-labelledby="visual-matches-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 text-xs font-semibold">
              <ScanSearch className="h-3.5 w-3.5 text-purple-700" aria-hidden="true" />
              Google Lens · engine=google_lens
            </span>
            {state === 'ready' && matches.length > 0 && (
              <span className="rounded-full bg-deal-50 border border-deal-200 text-deal-700 px-2.5 py-0.5 text-xs font-semibold">
                {matches.length} visual matches found
              </span>
            )}
          </div>
          <h2 id="visual-matches-heading" className="mt-2 text-xl font-black tracking-tight sm:text-2xl text-ink-900">
            Matched <span className="gradient-text">by pixels</span>, not keywords
          </h2>
          <p className="text-ink-500 mt-1 text-xs sm:text-sm">
            Visually similar products found directly from your photo via SerpApi Google Lens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === 'ready' && isDemo && <DemoBadge label="Demo" />}
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 text-ink-400 hover:text-ink-800"
            aria-label="Hide visually similar products"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading state with animated radar spinner */}
      {state === 'loading' && (
        <div className="mt-6 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100/80 border border-purple-200 shadow-sm relative">
            <Loader2 className="h-7 w-7 animate-spin text-purple-700" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
            </span>
          </div>
          <h3 className="mt-4 text-sm font-bold text-ink-900">
            Scanning image with Google Lens…
          </h3>
          <p className="text-ink-500 mt-1 max-w-sm mx-auto text-xs">
            SerpApi is uploading your photo and querying Google Lens for pixel-perfect product matches.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-left">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="card overflow-hidden border border-ink-100 bg-white">
                <div className="skeleton aspect-square w-full" />
                <div className="space-y-2 p-3">
                  <div className="skeleton h-3 w-4/5" />
                  <div className="skeleton h-3 w-2/5" />
                  <div className="skeleton h-6 w-full rounded-lg mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <p className="text-ink-500 bg-ink-50 mt-6 rounded-2xl border border-ink-100 px-5 py-4 text-sm">
          Visual matching is unavailable right now — your text results above are unaffected.
        </p>
      )}

      {state === 'ready' && matches.length === 0 && (
        <p className="text-ink-500 bg-ink-50 mt-6 rounded-2xl border border-ink-100 px-5 py-4 text-sm">
          No visually similar products found for this photo.
        </p>
      )}

      {state === 'ready' && matches.length > 0 && (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {matches.map((match, index) => (
            <li
              key={match.id}
              className="card card-hover group animate-[var(--animate-fade-up)] flex flex-col overflow-hidden border border-ink-100 bg-white shadow-xs hover:border-purple-300"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <div className="bg-ink-50/60 relative aspect-square w-full overflow-hidden">
                {match.thumbnail ? (
                  <img
                    src={match.thumbnail}
                    alt={match.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.08]"
                  />
                ) : (
                  <div className="text-ink-300 flex h-full w-full items-center justify-center">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                {match.in_stock === false && (
                  <span className="bg-ink-900/80 absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
                    Out of stock
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-3">
                <a
                  href={match.link ?? undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group/link block"
                  aria-label={`View ${match.title}`}
                >
                  <p className="text-ink-900 line-clamp-2 text-xs leading-snug font-semibold transition-colors duration-300 group-hover/link:text-purple-700" title={match.title}>
                    {match.title}
                  </p>
                </a>

                <div className="mt-2 flex items-baseline justify-between gap-1">
                  <span className="font-mono text-sm font-bold text-ink-900">
                    {match.price_formatted ?? '—'}
                  </span>
                  {match.rating !== null && (
                    <span className="text-ink-500 inline-flex items-center gap-0.5 text-[11px] font-medium">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      {match.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="text-ink-400 mt-1 flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-[85px] font-medium">{match.source ?? 'Web'}</span>
                  {match.link && (
                    <a
                      href={match.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-purple-600 hover:text-purple-800 transition p-0.5"
                      title="Open store page"
                      aria-label={`Open store page for ${match.title}`}
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                {/* Query action button */}
                <div className="mt-auto pt-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      if (onSearchMatch) {
                        onSearchMatch(match.title)
                      } else if (onSuggestQuery) {
                        onSuggestQuery(match.title)
                      }
                    }}
                    className="w-full rounded-lg border border-purple-200 bg-purple-50/70 py-1.5 px-2 text-[11px] font-semibold text-purple-900 hover:border-purple-400 hover:bg-purple-100 transition cursor-pointer flex items-center justify-center gap-1.5"
                    aria-label={`Use "${match.title}" as search query`}
                    title={`Use "${match.title}" as search query`}
                  >
                    <Search className="h-3 w-3 text-purple-700" aria-hidden="true" />
                    {onSearchMatch ? 'Search Deals' : 'Use as query'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {state === 'ready' && matches.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4 text-xs text-ink-500">
          <p className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />
            Matched by Google Lens visual descriptors via SerpApi · Ranked by visual similarity.
          </p>
          <p className="font-medium text-purple-700">
            Click &quot;Search Deals&quot; on any item to compare live seller prices.
          </p>
        </div>
      )}
    </section>
  )
}
