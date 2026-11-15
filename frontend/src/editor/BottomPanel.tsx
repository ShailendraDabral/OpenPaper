import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'
import type { CheckResult, Issue } from './latex/types'

interface Props {
  result: CheckResult
  open: boolean
  onToggle: () => void
  /** Go to the file and line of a problem. */
  onJump: (issue: Issue) => void
}

type Tab = 'problems' | 'log'

/** Bottom panel: problems found in the sources, and the log. The compiler's output will appear here too. */
export function BottomPanel({ result, open, onToggle, onJump }: Props) {
  const [tab, setTab] = useState<Tab>('problems')
  const select = (next: Tab) => {
    setTab(next)
    if (!open) onToggle()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        <div role="tablist" aria-label="Diagnostics" className="flex gap-1">
          <TabButton active={open && tab === 'problems'} onClick={() => select('problems')}>
            Problems
            <span className="flex items-center gap-2 text-xs font-normal">
              <Count icon={CircleAlert} n={result.errors} tone={result.errors ? 'text-[#b3261e] dark:text-[#f2b8b5]' : 'text-muted'} label="errors" />
              <Count icon={TriangleAlert} n={result.warnings} tone={result.warnings ? 'text-[#9a6200] dark:text-[#e9cf96]' : 'text-muted'} label="warnings" />
            </span>
          </TabButton>
          <TabButton active={open && tab === 'log'} onClick={() => select('log')}>
            Log
          </TabButton>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Hide diagnostics' : 'Show diagnostics'}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-surface hover:text-ink"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div role="tabpanel" className="min-h-0 flex-1 overflow-auto border-t border-line">
          {tab === 'log' ? (
            <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-body">{result.log}</pre>
          ) : result.issues.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-body">
              <CircleCheck className="h-4 w-4 text-[#1d6b4f] dark:text-[#8fd6b4]" aria-hidden="true" />
              No problems found by the source checks.
            </p>
          ) : (
            <ul>
              {result.issues.map((issue, i) => (
                <li key={i} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => onJump(issue)} className="flex w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-surface">
                    {issue.severity === 'error' ? (
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b3261e] dark:text-[#f2b8b5]" aria-label="Error" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6200] dark:text-[#e9cf96]" aria-label="Warning" />
                    )}
                    <span className="min-w-0 flex-1 text-sm text-ink">{issue.message}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {issue.file}:{issue.line}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('flex h-7 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium', active ? 'bg-surface text-ink' : 'text-body hover:text-ink')}
    >
      {children}
    </button>
  )
}

function Count({ icon: Icon, n, tone, label }: { icon: typeof CircleAlert; n: number; tone: string; label: string }) {
  return (
    <span className={cn('flex items-center gap-1 tabular-nums', tone)} aria-label={`${n} ${label}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {n}
    </span>
  )
}
