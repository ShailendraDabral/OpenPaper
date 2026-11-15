import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'border border-line bg-raised text-ink hover:border-muted',
  ghost: 'text-body hover:bg-surface hover:text-ink',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
  /** Internal route: renders a router <Link>. */
  to?: string
  /** External URL: renders an <a>. */
  href?: string
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
}

export function Button({ children, variant = 'primary', size = 'md', className, to, href, ...rest }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className)
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={rest['aria-label']}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} target="_blank" rel="noreferrer" aria-label={rest['aria-label']}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
