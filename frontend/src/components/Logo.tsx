import { cx } from '../lib/format'

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'from-brand-600 to-accent-600 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-[var(--shadow-glow)]',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" role="img">
        <path
          d="M4.5 3.75h5.1a2.25 2.25 0 0 1 1.59.66l7.02 7.02a2.25 2.25 0 0 1 0 3.18l-4.44 4.44a2.25 2.25 0 0 1-3.18 0L3.6 12.06a2.25 2.25 0 0 1-.66-1.59V5.25c0-.83.67-1.5 1.5-1.5Z"
          stroke="white"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="7.95" cy="7.95" r="1.35" fill="white" />
        <path
          d="M12.4 17.1c1.4 1.4 3.9 1.35 5.5-.25 1.6-1.6 1.65-4.1.25-5.5"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
