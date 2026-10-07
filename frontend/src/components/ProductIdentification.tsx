import { useEffect, useState } from 'react'
import { Info, PencilLine, Search, Sparkles } from 'lucide-react'
import type { VisionAttributes } from '../types/product'
import { cx } from '../lib/format'
import { DemoBadge } from './DemoBadge'

interface ProductIdentificationProps {
  analysis: VisionAttributes
  query: string
  onQueryChange: (query: string) => void
  onSearch: () => void
  searching?: boolean
  className?: string
}

/**
 * Shows what the AI recognised and lets the user fix the generated query
 * before it goes to SerpApi - recognition is never assumed to be perfect.
 */
export function ProductIdentification({
  analysis,
  query,
  onQueryChange,
  onSearch,
  searching = false,
  className,
}: ProductIdentificationProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(query)

  useEffect(() => {
    setDraft(query)
  }, [query])

  const confidencePercent =
    analysis.confidence === null ? null : Math.round(analysis.confidence * 100)

  const commit = () => {
    const cleaned = draft.trim()
    if (cleaned && cleaned !== query) onQueryChange(cleaned)
    setEditing(false)
  }

  return (
    <section
      className={cx('card animate-[var(--animate-fade-up)] p-6 sm:p-7', className)}
      aria-labelledby="identified-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="identified-heading" className="label flex items-center gap-2">
          <Sparkles className="text-brand-500 h-3.5 w-3.5" aria-hidden="true" />
          Identified product
        </p>
        {analysis.is_demo && <DemoBadge />}
      </div>

      <h2 className="mt-3 text-xl font-bold sm:text-2xl">{analysis.product_name}</h2>

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {analysis.brand && (
          <div className="flex gap-2 text-sm">
            <dt className="text-ink-500 w-20 shrink-0">Brand</dt>
            <dd className="text-ink-900 font-medium">{analysis.brand}</dd>
          </div>
        )}
        {analysis.category && (
          <div className="flex gap-2 text-sm">
            <dt className="text-ink-500 w-20 shrink-0">Category</dt>
            <dd className="text-ink-900 font-medium">{analysis.category}</dd>
          </div>
        )}
        {confidencePercent !== null && (
          <div className="flex items-center gap-2 text-sm">
            <dt className="text-ink-500 w-20 shrink-0">Confidence</dt>
            <dd className="flex items-center gap-2">
              <span className="bg-ink-100 h-1.5 w-24 overflow-hidden rounded-full">
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
              <span className="text-ink-700 font-medium">{confidencePercent}%</span>
            </dd>
          </div>
        )}
      </dl>

      {analysis.description && (
        <p className="text-ink-600 mt-4 text-sm leading-relaxed">{analysis.description}</p>
      )}

      {analysis.attributes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Visual attributes">
          {analysis.attributes.map((attribute) => (
            <li key={attribute} className="chip">
              {attribute}
            </li>
          ))}
        </ul>
      )}

      <div className="border-ink-100 mt-6 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="search-query" className="label">
            Search query
          </label>
          <button
            type="button"
            onClick={() => (editing ? commit() : setEditing(true))}
            className="btn-ghost !px-2 !py-1 text-xs"
            aria-label={editing ? 'Save search query' : 'Edit search query'}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <textarea
            id="search-query"
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                commit()
              }
              if (event.key === 'Escape') {
                setDraft(query)
                setEditing(false)
              }
            }}
            className="field mt-2 resize-none font-medium"
            autoFocus
          />
        ) : (
          <p
            id="search-query"
            className="border-ink-100 bg-ink-50 text-ink-900 mt-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium"
          >
            {query || analysis.search_query}
          </p>
        )}

        <button
          type="button"
          onClick={onSearch}
          disabled={searching || !(query || analysis.search_query).trim()}
          className="btn-primary btn-lg mt-4 w-full sm:w-auto"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {searching ? 'Searching…' : 'Search Products'}
        </button>
      </div>

      {analysis.notes.length > 0 && (
        <ul className="text-ink-500 mt-5 space-y-1.5 text-xs">
          {analysis.notes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
