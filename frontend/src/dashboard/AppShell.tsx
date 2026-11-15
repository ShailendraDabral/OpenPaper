import { FileStack, FolderOpen, type LucideIcon, Settings } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { routes } from '../app/site'
import { isDesktop } from '../backend'
import { Logo } from '../components/ui/Logo'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../lib/cn'
import { NewProjectDialog } from './NewProjectDialog'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const nav: NavItem[] = [
  { to: routes.projects, label: 'Projects', icon: FolderOpen },
  { to: routes.templates, label: 'Templates', icon: FileStack },
  { to: routes.settings, label: 'Settings', icon: Settings },
]

export interface ShellContext {
  /** Open the "New project" dialog, optionally with a template chosen. */
  newProject: (templateName?: string) => void
}

export function useShell() {
  return useOutletContext<ShellContext>()
}

/** Frame for the screens outside a project: navigation on the left, page on the right. */
export function AppShell() {
  const [dialog, setDialog] = useState<{ templateName?: string } | null>(null)
  const context: ShellContext = { newProject: (templateName) => setDialog({ templateName }) }

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <aside className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2 md:sticky md:top-0 md:h-screen md:w-56 md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:p-0">
        <div className="flex h-10 items-center px-2 md:h-16 md:px-5">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-1 gap-0.5 md:flex-col md:px-3 md:pt-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-raised font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-body hover:bg-line/50 hover:text-ink',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between md:border-t md:border-line md:p-3">
          <span className="hidden text-xs text-muted md:inline">Version 0.1</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {!isDesktop && (
          <p className="border-b border-line bg-accent-soft px-4 py-2 text-sm text-ink sm:px-8">
            Browser preview. It cannot reach folders on your computer, so projects here live in memory and vanish on
            reload. The desktop app works on real folders.
          </p>
        )}
        <main>
          <Outlet context={context} />
        </main>
      </div>

      <NewProjectDialog open={dialog !== null} templateName={dialog?.templateName} onClose={() => setDialog(null)} />
    </div>
  )
}
