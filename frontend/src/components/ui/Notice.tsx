import { CircleCheck, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface Props {
  children: ReactNode
  /** "info" explains a limitation; "success" confirms an action. */
  tone?: 'info' | 'success'
  onDismiss?: () => void
  className?: string
}

/** Inline message bar. */
export function Notice({ children, tone = 'info', onDismiss, className }: Props) {
  const Icon = tone === 'success' ? CircleCheck : Info
  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-lg border border-line bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink', className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 text-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
