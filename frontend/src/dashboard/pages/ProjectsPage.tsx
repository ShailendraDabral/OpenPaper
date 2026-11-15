import { FolderOpen, FolderX, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useProject } from '../../app/ProjectProvider'
import { backend, isDesktop, type RecentProject } from '../../backend'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice } from '../../components/ui/Notice'
import { PageContainer, PageHeader } from '../../components/ui/PageHeader'
import { buttonPrimary, buttonSecondary, card, sectionTitle } from '../../components/ui/styles'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { useShell } from '../AppShell'

export function ProjectsPage() {
  const { openFolder, openRecent, error, clearError } = useProject()
  const { newProject } = useShell()
  const [recent, setRecent] = useState<RecentProject[] | null>(null)

  const load = useCallback(() => {
    backend
      .recentProjects()
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])
  useEffect(load, [load])

  const forget = async (path: string) => {
    await backend.forgetRecent(path).catch(() => undefined)
    load()
  }

  const openLabel = isDesktop ? 'Open folder' : 'Open sample project'

  return (
    <PageContainer narrow>
      <PageHeader
        title="Projects"
        description={
          isDesktop
            ? 'A project is a folder on your computer. OpenPaper edits the files in place; nothing is uploaded.'
            : 'In the desktop app, a project is a folder on your computer.'
        }
        actions={
          <>
            <button type="button" className={buttonSecondary} onClick={openFolder}>
              <FolderOpen className="h-4 w-4" aria-hidden="true" /> {openLabel}
            </button>
            <button type="button" className={buttonPrimary} onClick={() => newProject()}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New project
            </button>
          </>
        }
      />

      {error && (
        <Notice className="mt-6" onDismiss={clearError}>
          {error}
        </Notice>
      )}

      <section className="mt-10" aria-labelledby="recent-title">
        <h2 id="recent-title" className={sectionTitle}>
          Recent projects
        </h2>

        {recent === null ? null : recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No projects yet. Create one, or open a folder that already holds a LaTeX project.</EmptyState>
          </div>
        ) : (
          <ul className={cn(card, 'mt-4 divide-y divide-line overflow-hidden')}>
            {recent.map((p) => (
              <li key={p.path} className="flex items-center gap-2 pr-2 hover:bg-surface/70">
                <button
                  type="button"
                  disabled={!p.exists}
                  onClick={() => openRecent(p.path)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-left disabled:cursor-not-allowed"
                >
                  {p.exists ? (
                    <FolderOpen className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <FolderX className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium', p.exists ? 'text-ink' : 'text-muted')}>{p.name}</span>
                    <span className="block truncate font-mono text-xs text-muted">{p.path}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {p.exists ? `Opened ${formatRelative((Date.now() - p.openedMs) / 60000).toLowerCase()}` : 'Folder not found'}
                  </span>
                </button>
                {isDesktop && (
                  <button
                    type="button"
                    onClick={() => forget(p.path)}
                    aria-label={`Remove ${p.name} from this list`}
                    title="Remove from this list (the folder is not deleted)"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line/60 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}
