import { RefreshCw, Trash2 } from 'lucide-react'
import { cx } from '../lib/format'
import { formatBytes } from '../lib/image'

interface ImagePreviewProps {
  src: string
  fileName?: string
  fileSize?: number
  onRemove: () => void
  onReplace?: () => void
  disabled?: boolean
  className?: string
  /** Compact variant used in the results header. */
  compact?: boolean
}

export function ImagePreview({
  src,
  fileName,
  fileSize,
  onRemove,
  onReplace,
  disabled,
  className,
  compact = false,
}: ImagePreviewProps) {
  return (
    <figure
      className={cx(
        'card overflow-hidden',
        compact ? 'w-full' : 'animate-[var(--animate-fade-up)]',
        className,
      )}
    >
      <div
        className={cx(
          'bg-ink-50 flex items-center justify-center',
          compact ? 'aspect-square' : 'aspect-4/3',
        )}
      >
        <img
          src={src}
          alt={fileName ? `Uploaded product photo: ${fileName}` : 'Uploaded product photo'}
          className={cx('h-full w-full', compact ? 'object-cover' : 'object-contain')}
          loading="lazy"
          decoding="async"
        />
      </div>

      {(!disabled || fileName) && (
        <figcaption
          className={cx(
            'border-ink-100 flex gap-3 border-t',
            compact ? 'flex-col p-3' : 'flex-wrap items-center justify-between p-4',
          )}
        >
          <div className="min-w-0">
            <p className="text-ink-800 truncate text-sm font-medium">{fileName ?? 'Your photo'}</p>
            {fileSize !== undefined && (
              <p className="text-ink-400 text-xs">{formatBytes(fileSize)}</p>
            )}
          </div>
          {!disabled && (
            <div className={cx('flex gap-2', compact && 'w-full')}>
              {onReplace && (
                <button
                  type="button"
                  onClick={onReplace}
                  className={cx('btn-secondary', compact && 'flex-1 !px-3 !py-2 text-xs')}
                  aria-label="Replace image"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Replace
                </button>
              )}
              <button
                type="button"
                onClick={onRemove}
                className={cx(
                  'btn-secondary border-red-100 text-red-600 hover:border-red-200 hover:bg-red-50',
                  compact && 'flex-1 !px-3 !py-2 text-xs',
                )}
                aria-label="Remove image"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          )}
        </figcaption>
      )}
    </figure>
  )
}
