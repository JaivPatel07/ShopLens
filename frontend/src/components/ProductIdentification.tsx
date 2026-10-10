import { useEffect, useState } from 'react'
import { Check, Info, PencilLine, ScanSearch, Search, Sparkles, X } from 'lucide-react'
import type { VisionAttributes } from '../types/product'
import { cx } from '../lib/format'
import { DemoBadge } from './DemoBadge'

interface ProductIdentificationProps {
  analysis: VisionAttributes
  query: string
  onQueryChange: (query: string) => void
  onSearch: (query?: string) => void
  searching?: boolean
  className?: string
  lensMatchCount?: number
  suggestedQueries?: string[]
}

export function ProductIdentification({
  analysis,
  query,
  onQueryChange,
  onSearch,
  searching = false,
  className,
  lensMatchCount,
  suggestedQueries,
}: ProductIdentificationProps) {
  const [editing, setEditing] = useState(false)
  const fallbackName =
    analysis.product_name && analysis.product_name !== 'Product not confidently identified'
      ? analysis.product_name.trim()
      : ''
  const displayedQuery = query?.trim() || analysis.search_query?.trim() || fallbackName
  const [draft, setDraft] = useState(displayedQuery)
  const isConfident = Boolean(
    analysis.detected &&
      typeof analysis.confidence === 'number' &&
      analysis.confidence > 0 &&
      analysis.product_name !== 'Product not confidently identified',
  )
  const confidencePercent =
    isConfident && analysis.confidence !== null ? Math.round(analysis.confidence * 100) : null

  useEffect(() => {
    if (!query && displayedQuery) {
      onQueryChange(displayedQuery)
    }
  }, [query, displayedQuery, onQueryChange])

  useEffect(() => {
    if (!editing) setDraft(displayedQuery)
  }, [displayedQuery, editing])

  const commit = () => {
    const cleaned = draft.trim()
    if (cleaned && cleaned !== displayedQuery) onQueryChange(cleaned)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(displayedQuery)
    setEditing(false)
  }

  return (
    <section
      className={cx('card animate-[var(--animate-fade-up)] min-w-0 p-5 sm:p-7', className)}
      aria-labelledby="identified-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="identified-heading" className="label flex items-center gap-2">
          <Sparkles className="text-brand-500 h-3.5 w-3.5" aria-hidden="true" />
          Identified product
        </p>
        <div className="flex items-center gap-2">
          {typeof lensMatchCount === 'number' && lensMatchCount > 0 ? (
            <span className="border-purple-200 bg-purple-50 text-purple-700 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
              <ScanSearch className="h-3 w-3" aria-hidden="true" />
              Visual matches found
            </span>
          ) : isConfident && !analysis.is_demo ? (
            <span className="border-deal-100 bg-deal-50 text-deal-700 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold">
              <Check className="h-3 w-3" aria-hidden="true" />
              Ready to search
            </span>
          ) : !isConfident ? (
            <span className="border-amber-200 bg-amber-50 text-amber-700 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold">
              <Info className="h-3 w-3" aria-hidden="true" />
              Low confidence
            </span>
          ) : null}
          {analysis.is_demo && <DemoBadge />}
        </div>
      </div>

      <h2 className="mt-3 wrap-break-word text-xl font-bold sm:text-2xl">{analysis.product_name}</h2>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {analysis.brand && (
          <div className="border-ink-100 bg-ink-50/70 min-w-0 rounded-xl border px-3 py-2.5 text-sm">
            <dt className="text-ink-500 text-xs font-medium">Brand</dt>
            <dd className="text-ink-900 mt-0.5 wrap-break-word font-medium">{analysis.brand}</dd>
          </div>
        )}
        {analysis.category && (
          <div className="border-ink-100 bg-ink-50/70 min-w-0 rounded-xl border px-3 py-2.5 text-sm">
            <dt className="text-ink-500 text-xs font-medium">Category</dt>
            <dd className="text-ink-900 mt-0.5 wrap-break-word font-medium">{analysis.category}</dd>
          </div>
        )}
        <div className="border-ink-100 bg-ink-50/70 rounded-xl border px-3 py-2.5 text-sm">
          <dt className="text-ink-500 text-xs font-medium">Recognition confidence</dt>
          {isConfident && confidencePercent !== null ? (
            <dd className="mt-1.5 flex items-center gap-2">
              <span
                className="bg-ink-100 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Recognition confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={confidencePercent}
              >
                <span
                  className={cx(
                    'block h-full rounded-full',
                    confidencePercent >= 65
                      ? 'bg-deal-500'
                      : confidencePercent >= 40
                        ? 'bg-amber-400'
                        : 'bg-red-400',
                  )}
                  style={{ width: `${confidencePercent}%` }}
                />
              </span>
              <span className="text-ink-700 shrink-0 font-medium">{confidencePercent}%</span>
            </dd>
          ) : (
            <dd className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {analysis.product_name === 'Product not confidently identified' || !analysis.detected
                  ? 'Product not confidently identified'
                  : 'Recognition unavailable'}
              </span>
            </dd>
          )}
        </div>

        {typeof lensMatchCount === 'number' && lensMatchCount > 0 && (
          <div className="border-purple-100 bg-purple-50/60 rounded-xl border px-3 py-2.5 text-sm">
            <dt className="text-purple-700 text-xs font-medium flex items-center gap-1.5">
              <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
              Google Lens visual match status
            </dt>
            <dd className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-100/90 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-900">
                Visual matches found ({lensMatchCount})
              </span>
            </dd>
          </div>
        )}
      </dl>

      {analysis.description && (
        <p className="text-ink-600 mt-4 wrap-break-word text-sm leading-relaxed">
          {analysis.description}
        </p>
      )}

      {analysis.attributes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Visual attributes">
          {analysis.attributes.map((attribute) => (
            <li key={attribute} className="chip max-w-full wrap-break-word">
              {attribute}
            </li>
          ))}
        </ul>
      )}

      <div className="border-ink-100 mt-6 border-t pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <label htmlFor="search-query" className="label">
              Search query
            </label>
            <p className="text-ink-500 mt-1 text-xs">Check or adjust this before looking for offers.</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(displayedQuery)
                setEditing(true)
              }}
              className="btn-ghost !px-2 !py-1 text-xs"
              aria-label="Edit search query"
            >
              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
          )}
        </div>

        {suggestedQueries && suggestedQueries.length > 0 && (
          <div className="mt-3.5 mb-2 rounded-xl border border-purple-200/80 bg-purple-50/50 p-3.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />
              <p className="text-xs font-semibold text-purple-900">
                Suggested queries from Google Lens
              </p>
            </div>
            <p className="text-ink-500 mt-0.5 text-xs">
              {isConfident
                ? 'Alternative search terms from visual matches:'
                : 'Identification is unconfident. Click a visual match title below to use and edit it:'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {suggestedQueries.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    onQueryChange(suggestion)
                    setDraft(suggestion)
                  }}
                  className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-950 hover:border-purple-400 hover:bg-purple-100 transition cursor-pointer text-left line-clamp-1 max-w-full shadow-xs"
                  title={`Use "${suggestion}" as search query`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {editing ? (
          <textarea
            id="search-query"
            value={draft}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                commit()
              }
              if (event.key === 'Escape') cancel()
            }}
            className="field mt-3 min-h-24 resize-y font-medium"
            autoFocus
          />
        ) : (
          <p
            id="search-query"
            className="border-ink-100 bg-ink-50 text-ink-900 mt-3 wrap-break-word rounded-xl border px-3.5 py-2.5 text-sm font-medium"
          >
            {displayedQuery}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {editing ? (
            <>
              <button type="button" onClick={cancel} className="btn-secondary w-full sm:w-auto">
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={commit}
                className="btn-primary w-full sm:w-auto"
                aria-label="Save search query"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Save query
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSearch(displayedQuery)}
              disabled={searching || !displayedQuery.trim()}
              className="btn-primary btn-lg w-full sm:w-auto"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {searching ? 'Searching…' : 'Search Products'}
            </button>
          )}
        </div>
      </div>

      {analysis.notes.length > 0 && (
        <ul className="text-ink-500 mt-5 space-y-1.5 text-xs">
          {analysis.notes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="wrap-break-word">{note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
