import { Check, Loader2 } from 'lucide-react'
import { cx } from '../lib/format'

export interface ProgressStage {
  label: string
  done: boolean
  active?: boolean
}

interface LoadingStateProps {
  title: string
  subtitle?: string
  stages?: ProgressStage[]
  className?: string
}

export function LoadingState({ title, subtitle, stages, className }: LoadingStateProps) {
  return (
    <div
      className={cx('card animate-[var(--animate-fade-up)] p-6 sm:p-8', className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <span className="bg-brand-50 text-brand-600 relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          {subtitle && <p className="text-ink-500 mt-1 text-sm">{subtitle}</p>}
        </div>
      </div>

      {stages && stages.length > 0 && (
        <ol className="mt-6 space-y-3">
          {stages.map((stage) => {
            const active = stage.active ?? (!stage.done && stages.find((s) => !s.done) === stage)
            return (
              <li key={stage.label} className="flex items-center gap-3 text-sm">
                <span
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full border transition',
                    stage.done
                      ? 'border-deal-500 bg-deal-500 text-white'
                      : active
                        ? 'border-brand-400 text-brand-600 bg-white'
                        : 'border-ink-200 text-ink-300 bg-white',
                  )}
                >
                  {stage.done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : active ? (
                    <span className="bg-brand-500 h-2 w-2 animate-ping rounded-full" aria-hidden="true" />
                  ) : (
                    <span className="bg-ink-200 h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={cx(
                    'transition',
                    stage.done ? 'text-ink-400' : active ? 'text-ink-900 font-medium' : 'text-ink-400',
                  )}
                >
                  {stage.label}
                </span>
                {active && <span className="skeleton ml-auto h-1.5 w-16" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
