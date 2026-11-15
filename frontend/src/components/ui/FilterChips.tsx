import { cn } from '../../lib/cn'

interface Props<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Filter templates". */
  label: string
  size?: 'sm' | 'md'
}

/** Single-choice filter rendered as a row of toggle buttons. */
export function FilterChips<T extends string>({ options, value, onChange, label, size = 'md' }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md border font-medium transition-colors',
            size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-8 px-3 text-[13px]',
            value === option
              ? 'border-primary bg-primary text-primary-fg'
              : 'border-line bg-raised text-body hover:border-muted hover:text-ink',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
