import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Standard width and padding for pages inside the dashboard shell. */
export function PageContainer({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-8 sm:px-8 sm:py-10', narrow ? 'max-w-3xl' : 'max-w-[72rem]')}>{children}</div>
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Buttons shown to the right of the title. */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-medium text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-2xl leading-relaxed text-body">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
