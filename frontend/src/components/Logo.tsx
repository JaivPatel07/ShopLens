import { cx } from '../lib/format'

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={cx('h-9 w-9 shrink-0 drop-shadow-sm', className)}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="shoplens-brand" x1="100" y1="90" x2="405" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D946EF" />
          <stop offset=".52" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#1677FF" />
        </linearGradient>
        <linearGradient id="shoplens-lens" x1="180" y1="170" x2="330" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C4B5FD" />
        </linearGradient>
      </defs>

      {/* Shopping bag handle */}
      <path
        d="M190 166V137C190 100 219 72 256 72C293 72 322 100 322 137V166"
        stroke="url(#shoplens-brand)"
        strokeWidth="20"
        strokeLinecap="round"
      />

      {/* Bag body */}
      <path
        d="M147 153 Q147 137 164 137 H348 Q365 137 368 155 L398 366 Q402 393 375 393 H137 Q110 393 114 366Z"
        fill="url(#shoplens-brand)"
      />

      {/* Scanning speed lines */}
      <path
        d="M77 220H119 M57 256H110 M77 292H113"
        stroke="url(#shoplens-brand)"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Scan corners */}
      <g stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M184 206V191H202" />
        <path d="M328 191H346V209" />
        <path d="M184 310V328H202" />
        <path d="M328 328H346V310" />
      </g>

      {/* Camera lens */}
      <circle cx="265" cy="260" r="65" fill="#190D35" stroke="#FFFFFF" strokeWidth="12" />
      <circle cx="265" cy="260" r="43" fill="#26154E" />
      <circle cx="265" cy="260" r="25" fill="url(#shoplens-lens)" />
      <circle cx="273" cy="251" r="9" fill="#FFFFFF" opacity=".8" />
    </svg>
  )
}
