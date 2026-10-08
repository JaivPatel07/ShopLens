import { useEffect, useState } from 'react'
import { Camera, ExternalLink, ImageOff, ScanSearch, Star, X } from 'lucide-react'
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
}: {
  imageFile: File | null
  className?: string
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
      })
      .catch(() => {
        if (cancelled) return
        setResult({ file: imageFile, matches: [], isDemo: false, failed: true })
      })
    return () => {
      cancelled = true
    }
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
      className={cx('animate-[var(--animate-fade-up)]', className)}
      aria-labelledby="visual-matches-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label flex items-center gap-2">
            <ScanSearch className="text-brand-500 h-3.5 w-3.5" aria-hidden="true" />
            Google Lens · engine=google_lens
          </p>
          <h2 id="visual-matches-heading" className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
            Found <span className="gradient-text">by pixels</span>, not keywords
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Visually similar products matched from your photo via SerpApi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === 'ready' && isDemo && <DemoBadge label="Demo" />}
          <button
            type="button"
            className="btn-ghost !px-2 !py-2"
            aria-label="Hide visually similar products"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {state === 'loading' && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card overflow-hidden">
              <div className="skeleton aspect-square w-full" />
              <div className="space-y-2 p-3">
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3 w-2/5" />
              </div>
            </div>
          ))}
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
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {matches.map((match, index) => (
            <li
              key={match.id}
              className="card card-hover group animate-[var(--animate-fade-up)] overflow-hidden"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <a
                href={match.link ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-full flex-col"
                aria-label={`View ${match.title}`}
              >
                <div className="bg-ink-50 relative aspect-square w-full overflow-hidden">
                  {match.thumbnail ? (
                    <img
                      src={match.thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                    />
                  ) : (
                    <div className="text-ink-300 flex h-full w-full items-center justify-center">
                      <ImageOff className="h-6 w-6" aria-hidden="true" />
                    </div>
                  )}
                  {match.in_stock === false && (
                    <span className="bg-ink-900/80 absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                      Out of stock
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="text-ink-900 line-clamp-2 text-xs leading-snug font-semibold transition-colors duration-300 group-hover:text-brand-700">
                    {match.title}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-bold">
                      {match.price_formatted ?? '—'}
                    </span>
                    {match.rating !== null && (
                      <span className="text-ink-500 inline-flex items-center gap-0.5 text-[11px]">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        {match.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="text-ink-400 mt-auto flex items-center justify-between pt-2 text-[11px]">
                    <span className="truncate">{match.source ?? 'Web'}</span>
                    <ExternalLink
                      className="h-3 w-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {state === 'ready' && matches.length > 0 && (
        <p className="text-ink-400 mt-4 flex items-center gap-1.5 text-xs">
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          Matches come from Google Lens via SerpApi — sorted by visual similarity to your photo.
        </p>
      )}
    </section>
  )
}
