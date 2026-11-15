import { Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Copy, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { parseLatexLog } from './latex/logParser'
import type { CheckResult, Issue } from './latex/types'
import { cn } from '../lib/cn'

interface Props {
  result: CheckResult
  compilerLog?: string
  rootFile?: string | null
  open: boolean
  onToggle: () => void
  /** Go to the file and line of a problem. */
  onJump: (issue: Issue) => void
}

type Tab = 'problems' | 'log'
type Filter = 'all' | 'errors' | 'warnings'

/**
 * Bottom panel: Overleaf-style structured problems (parsed compiler errors & linter warnings),
 * and the complete compiler log with copy capability.
 */
export function BottomPanel({ result, compilerLog, rootFile, open, onToggle, onJump }: Props) {
  const [tab, setTab] = useState<Tab>('problems')
  const [filter, setFilter] = useState<Filter>('all')
  const [copied, setCopied] = useState(false)

  const select = (next: Tab) => {
    setTab(next)
    if (!open) onToggle()
  }

  // Parse compiler log and merge with source check issues
  const allIssues = useMemo(() => {
    const fromCompiler = compilerLog ? parseLatexLog(compilerLog, rootFile || 'main.tex') : []
    const combined = [...fromCompiler, ...result.issues]

    // Deduplicate
    const seen = new Set<string>()
    return combined.filter((item) => {
      const key = `${item.file}:${item.line}:${item.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [compilerLog, result.issues, rootFile])

  const errorCount = useMemo(() => allIssues.filter((i) => i.severity === 'error').length, [allIssues])
  const warningCount = useMemo(() => allIssues.filter((i) => i.severity === 'warning').length, [allIssues])

  const filteredIssues = useMemo(() => {
    if (filter === 'errors') return allIssues.filter((i) => i.severity === 'error')
    if (filter === 'warnings') return allIssues.filter((i) => i.severity === 'warning')
    return allIssues
  }, [allIssues, filter])

  const displayLog = compilerLog || result.log

  const handleCopyLog = async () => {
    if (!displayLog) return
    try {
      await navigator.clipboard.writeText(displayLog)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas border-t border-line">
      {/* Top diagnostic header */}
      <div className="flex h-9 shrink-0 items-center gap-2 px-2">
        <div role="tablist" aria-label="Diagnostics" className="flex gap-1">
          <TabButton active={open && tab === 'problems'} onClick={() => select('problems')}>
            Problems
            <span className="flex items-center gap-1.5 text-xs font-normal">
              <Count icon={CircleAlert} n={errorCount} tone={errorCount ? 'text-[#b3261e] dark:text-[#f2b8b5]' : 'text-muted'} label="errors" />
              <Count icon={TriangleAlert} n={warningCount} tone={warningCount ? 'text-[#9a6200] dark:text-[#e9cf96]' : 'text-muted'} label="warnings" />
            </span>
          </TabButton>
          <TabButton active={open && tab === 'log'} onClick={() => select('log')}>
            Compiler Log
          </TabButton>
        </div>

        {open && tab === 'problems' && allIssues.length > 0 && (
          <div className="ml-4 flex items-center gap-1 rounded bg-surface p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn('rounded px-2 py-0.5 transition-colors', filter === 'all' ? 'bg-canvas text-ink font-medium shadow-sm' : 'text-muted hover:text-ink')}
            >
              All ({allIssues.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('errors')}
              className={cn('rounded px-2 py-0.5 transition-colors', filter === 'errors' ? 'bg-canvas text-[#b3261e] dark:text-[#f2b8b5] font-medium shadow-sm' : 'text-muted hover:text-ink')}
            >
              Errors ({errorCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('warnings')}
              className={cn('rounded px-2 py-0.5 transition-colors', filter === 'warnings' ? 'bg-canvas text-[#9a6200] dark:text-[#e9cf96] font-medium shadow-sm' : 'text-muted hover:text-ink')}
            >
              Warnings ({warningCount})
            </button>
          </div>
        )}

        {open && tab === 'log' && displayLog && (
          <button
            type="button"
            onClick={handleCopyLog}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink rounded px-2 py-1 bg-surface border border-line"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy Log'}
          </button>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Hide diagnostics' : 'Show diagnostics'}
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-surface hover:text-ink', (!displayLog || tab !== 'log') && 'ml-auto')}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div role="tabpanel" className="min-h-0 flex-1 overflow-auto border-t border-line bg-canvas">
          {tab === 'log' ? (
            <pre className="p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-body select-text">
              {displayLog || 'No compiler output recorded yet. Compile your project to view logs.'}
            </pre>
          ) : filteredIssues.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-body">
              <CircleCheck className="h-4 w-4 text-[#1d6b4f] dark:text-[#8fd6b4]" aria-hidden="true" />
              {allIssues.length === 0 ? 'No problems found by compiler or source checks.' : `No ${filter} found.`}
            </p>
          ) : (
            <ul>
              {filteredIssues.map((issue, i) => (
                <li key={i} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onJump(issue)}
                    className="group flex w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-surface transition-colors"
                  >
                    {issue.severity === 'error' ? (
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b3261e] dark:text-[#f2b8b5]" aria-label="Error" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9a6200] dark:text-[#e9cf96]" aria-label="Warning" />
                    )}
                    <span className="min-w-0 flex-1 text-xs text-ink leading-relaxed font-normal">{issue.message}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted group-hover:text-ink transition-colors">
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
      className={cn('flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-medium', active ? 'bg-surface text-ink' : 'text-body hover:text-ink')}
    >
      {children}
    </button>
  )
}

function Count({ icon: Icon, n, tone, label }: { icon: typeof CircleAlert; n: number; tone: string; label: string }) {
  return (
    <span className={cn('flex items-center gap-0.5 tabular-nums', tone)} aria-label={`${n} ${label}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {n}
    </span>
  )
}
