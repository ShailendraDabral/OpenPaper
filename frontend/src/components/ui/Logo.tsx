import { cn } from '../../lib/cn'
import { site } from '../../app/site'

/** The mark: an open sheet with a folded corner and a baseline of text. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0b2545" />
      <path d="M9.5 7.5h9l4 4v13h-13z" fill="#ffffff" />
      <path d="M18.5 7.5v4h4z" fill="#9db9f5" />
      <path d="M12 15.5h8M12 18.5h8M12 21.5h5" stroke="#2b62d9" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="dark:ring-1 dark:ring-line dark:rounded-[7px]" />
      <span className="text-[17px] font-semibold tracking-tight text-ink">{site.name}</span>
    </span>
  )
}
