import type { ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { cx } from '../lib/format'

interface ErrorStateProps {
  title: string
  message: string
  /** Practical suggestions, e.g. "Try a clearer photo". */
  suggestions?: string[]
  onRetry?: () => void
  retryLabel?: string
  secondaryAction?: ReactNode
  className?: string
}

/** Friendly, non-technical error card. Technical detail stays in the backend log. */
export function ErrorState({
  title,
  message,
  suggestions,
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cx('card border-red-100 animate-[var(--animate-fade-up)] p-6 sm:p-8', className)}
      role="alert"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          <p className="text-ink-600 mt-1 text-sm leading-relaxed">{message}</p>

          {suggestions && suggestions.length > 0 && (
            <ul className="text-ink-600 mt-4 space-y-1.5 text-sm">
              {suggestions.map((suggestion) => (
                <li key={suggestion} className="flex items-start gap-2">
                  <span className="bg-ink-300 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
                  {suggestion}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {onRetry && (
              <button type="button" onClick={onRetry} className="btn-primary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {retryLabel}
              </button>
            )}
            {secondaryAction}
          </div>
        </div>
      </div>
    </div>
  )
}
