import type { ReactNode } from 'react'

/** Dashed box for "nothing here" and "no matches" states. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-body">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Shared "no search results" state. */
export function NoMatches({ what, query, onClear }: { what: string; query: string; onClear: () => void }) {
  return (
    <EmptyState
      action={
        <button type="button" onClick={onClear} className="font-medium text-accent underline-offset-4 hover:underline">
          Clear search
        </button>
      }
    >
      No {what} match “{query.trim()}”.
    </EmptyState>
  )
}
