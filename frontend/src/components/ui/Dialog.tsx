import { X } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** False for a question that must be answered: no close button, Escape or click-away. */
  dismissible?: boolean
  children: ReactNode
}

/**
 * Modal built on the native <dialog>, which provides the focus trap,
 * Escape-to-close and the backdrop.
 */
export function Dialog({ open, onClose, title, description, dismissible = true, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // Start in the first form field rather than on the close button.
      el.querySelector<HTMLElement>('input, textarea, select')?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => !dismissible && e.preventDefault()}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose() // click on the backdrop
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-raised p-0 text-body shadow-page backdrop:bg-[#0b2545]/50"
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold text-ink">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm leading-relaxed text-body">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mt-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}

/* Shared form styles for dialogs. */
export const fieldLabel = 'block text-sm font-medium text-ink'
export const fieldInput =
  'mt-1.5 h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:border-accent'
export const fieldError = 'mt-1.5 text-sm text-[#b3261e] dark:text-[#f2b8b5]'
