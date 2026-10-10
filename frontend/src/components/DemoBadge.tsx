import { FlaskConical } from 'lucide-react'
import { cx } from '../lib/format'

export function DemoBadge({ className, label = 'Demo Data' }: { className?: string; label?: string }) {
  return (
    <span
      className={cx(
        'border-amber-300 bg-amber-50 text-amber-800 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
        className,
      )}
      title="This content comes from ShopLens's sample dataset, not from a live API call."
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
