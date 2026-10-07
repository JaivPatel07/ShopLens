import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Sparkles, UploadCloud } from 'lucide-react'
import { ACCEPTED_EXTENSIONS, ImageValidationError, validateImageFile } from '../lib/image'
import { cx } from '../lib/format'

interface UploadBoxProps {
  onSelect: (file: File) => void
  onTryDemo?: () => void
  disabled?: boolean
  maxSizeMb?: number
  supportedTypes?: string[]
  /** Validation message coming from the parent (e.g. backend rejection). */
  error?: string | null
  className?: string
}

/**
 * Drag & drop / click / keyboard upload area.
 * The dropzone is a real focusable control, so Enter and Space open the picker.
 */
export function UploadBox({
  onSelect,
  onTryDemo,
  disabled = false,
  maxSizeMb = 10,
  supportedTypes = ['JPG', 'JPEG', 'PNG', 'WEBP'],
  error,
  className,
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputId = useId()
  const descriptionId = `${inputId}-help`

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      try {
        validateImageFile(file)
        setLocalError(null)
        onSelect(file)
      } catch (validationError) {
        setLocalError(
          validationError instanceof ImageValidationError
            ? validationError.message
            : 'That image could not be used. Try another one.',
        )
      }
    },
    [onSelect],
  )

  // Allow pasting an image straight from the clipboard.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return
      const item = Array.from(event.clipboardData?.files ?? [])[0]
      if (item) handleFiles(event.clipboardData?.files ?? null)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, handleFiles])

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const shownError = localError ?? error

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={descriptionId}
        aria-label="Upload a product photo. Drop a file here or press Enter to browse."
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (disabled) return
          handleFiles(event.dataTransfer?.files ?? null)
        }}
        className={cx(
          'group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition duration-300 sm:py-16',
          dragging
            ? 'border-brand-500 bg-brand-50/70 scale-[1.01]'
            : 'border-ink-200 bg-ink-50/40 hover:border-brand-300 hover:bg-brand-50/40',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={cx(
            'from-brand-600 to-accent-600 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[var(--shadow-glow)] transition duration-300',
            dragging ? 'scale-110' : 'group-hover:scale-105',
          )}
          aria-hidden="true"
        >
          <UploadCloud className="h-7 w-7" />
        </span>

        <h3 className="mt-5 text-lg font-semibold sm:text-xl">Drop a product photo here</h3>
        <p className="text-ink-500 mt-1.5 text-sm">
          or click to browse — {supportedTypes.join(', ')} up to {maxSizeMb} MB
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={(event) => {
              event.stopPropagation()
              openPicker()
            }}
            disabled={disabled}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            Choose Image
          </button>
          {onTryDemo && (
            <button
              type="button"
              className="btn-secondary btn-lg"
              onClick={(event) => {
                event.stopPropagation()
                onTryDemo()
              }}
              disabled={disabled}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Try Demo Image
            </button>
          )}
        </div>

        <p id={descriptionId} className="text-ink-400 mt-5 max-w-md text-xs">
          Tip: a well-lit photo showing the whole product works best. You can also paste an image
          with Ctrl/Cmd + V.
        </p>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
          tabIndex={-1}
        />
      </div>

      {shownError && (
        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
          {shownError}
        </p>
      )}
    </div>
  )
}
