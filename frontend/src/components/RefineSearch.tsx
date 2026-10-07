import { useEffect, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { cx } from '../lib/format'

interface RefineSearchProps {
  query: string
  onRefine: (query: string) => void
  loading?: boolean
  /** Suggestions built from the identified product attributes. */
  suggestions?: string[]
  className?: string
}

const PREFIX = 'show only '

/**
 * Refine the query and run another SerpApi search without re-uploading the photo.
 */
export function RefineSearch({
  query,
  onRefine,
  loading = false,
  suggestions = [],
  className,
}: RefineSearchProps) {
  const [value, setValue] = useState(query)

  useEffect(() => {
    setValue(query)
  }, [query])

  const submit = (next: string) => {
    const cleaned = next.trim()
    if (!cleaned || loading) return
    onRefine(cleaned)
  }

  return (
    <section className={cx('card p-6 sm:p-7', className)} aria-labelledby="refine-heading">
      <h2 id="refine-heading" className="text-lg font-semibold sm:text-xl">
        Refine your search
      </h2>
      <p className="text-ink-500 mt-1 text-sm">
        Add a colour, size or model to narrow things down. This runs a fresh search through SerpApi.
      </p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          submit(value)
        }}
      >
        <label htmlFor="refine-input" className="sr-only">
          Refine your search query
        </label>
        <input
          id="refine-input"
          className="field sm:flex-1"
          placeholder={`e.g. ${query ? `${query} ` : ''}black`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={loading || !value.trim()}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {loading ? 'Searching…' : 'Search again'}
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-ink-400 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Quick refinements from the recognised product
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="chip hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
                  onClick={() => {
                    setValue(suggestion)
                    submit(suggestion)
                  }}
                  disabled={loading}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Build "show only <attribute>" style suggestions from recognised attributes. */
export function buildRefinements(baseQuery: string, attributes: string[]): string[] {
  const base = baseQuery.trim()
  return attributes
    .slice(0, 4)
    .map((attribute) => `${base} ${attribute}`.replace(/\s+/g, ' ').trim())
    .filter((suggestion) => suggestion.toLowerCase() !== base.toLowerCase())
    .slice(0, 3)
    .map((suggestion) => {
      // Keep the suggestion short and natural for the chip UI.
      return suggestion.length > 64 ? `${base} ${suggestion.split(' ').pop() ?? ''}`.trim() : suggestion
    })
}

export { PREFIX }
