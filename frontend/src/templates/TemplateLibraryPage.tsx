import { useState } from 'react'
import { TemplateThumbnail } from './TemplateThumbnail'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { NoMatches } from '../components/ui/EmptyState'
import { Notice } from '../components/ui/Notice'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { buttonPrimary, selectInput } from '../components/ui/styles'
import { type Template, type TemplateCategory, templateCategories, templates } from './templates'
import { cn } from '../lib/cn'
import { useShell } from '../dashboard/AppShell'

type Filter = 'All templates' | TemplateCategory

const columnsLabel = (t: Template) => (t.columns === 2 ? 'Two columns' : 'Single column')

export function TemplateLibraryPage() {
  const { newProject } = useShell()
  const [query, setQuery] = useState('')
  const clearQuery = () => setQuery('')
  const [category, setCategory] = useState<Filter>('All templates')
  const [selected, setSelected] = useState<Template | null>(null)

  const q = query.trim().toLowerCase()
  const matchesSearch = (t: Template) =>
    !q || [t.name, t.category, t.documentClass, t.description].some((f) => f.toLowerCase().includes(q))
  const searched = templates.filter(matchesSearch)
  const visible = searched.filter((t) => category === 'All templates' || t.category === category)
  const count = (c: Filter) => (c === 'All templates' ? searched.length : searched.filter((t) => t.category === c).length)
  const filters: Filter[] = ['All templates', ...templateCategories]

  const useTemplate = (t: Template) => {
    setSelected(null)
    newProject(t.name)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Template Library"
        description="Pick the format your journal, conference or university expects. Select a template to see what it contains."
      />
      <Notice className="mt-6">
        Templates for Springer Nature journals, MDPI and Wiley need a class file from the publisher's author kit. Those
        projects start with the plain article class and a note on what to add.
      </Notice>

      <label className="mt-6 block max-w-sm">
        <span className="sr-only">Search templates</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates"
          className={cn(selectInput, 'w-full placeholder:text-muted')}
        />
      </label>

      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Categories: a list on wide screens, a menu on small ones. */}
        <div>
          <label className="block lg:hidden">
            <span className="text-sm font-medium text-ink">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Filter)} className={cn(selectInput, 'mt-1.5 w-full')}>
              {filters.map((c) => (
                <option key={c} value={c}>
                  {c} ({count(c)})
                </option>
              ))}
            </select>
          </label>

          <nav aria-label="Template categories" className="sticky top-24 hidden lg:block">
            <ul className="space-y-0.5">
              {filters.map((c, i) => (
                <li key={c} className={cn(i === 1 && 'mt-2 border-t border-line pt-2')}>
                  <button
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-current={category === c ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                      category === c ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-body hover:bg-surface hover:text-ink',
                    )}
                  >
                    {c}
                    <span className="text-xs font-normal text-muted tabular-nums">{count(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="min-w-0">
          {visible.length === 0 ? (
            <NoMatches
              what="templates"
              query={q ? query : category}
              onClear={q ? clearQuery : () => setCategory('All templates')}
            />
          ) : (
            <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((t) => (
                <li key={t.name}>
                  <button type="button" onClick={() => setSelected(t)} className="group block w-full text-left" aria-haspopup="dialog">
                    <span className="flex h-44 items-end justify-center overflow-hidden rounded-lg border border-line bg-surface px-6 pt-6 transition-colors group-hover:border-muted">
                      <TemplateThumbnail layout={t.layout} />
                    </span>
                    <span className="mt-3 block text-xs text-muted">{t.category}</span>
                    <span className="mt-0.5 block text-[15px] font-semibold text-ink group-hover:text-accent">{t.name}</span>
                    <span className="mt-1 block text-sm text-body">
                      {columnsLabel(t)}, <code className="font-mono text-xs">{t.documentClass}</code>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? ''} description={selected?.description}>
        {selected && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 border-y border-line py-4 text-sm">
              <dt className="text-muted">Category</dt>
              <dd className="text-ink">{selected.category}</dd>
              <dt className="text-muted">Document class</dt>
              <dd className="font-mono text-[13px] text-ink">{selected.documentClass}</dd>
              <dt className="text-muted">Layout</dt>
              <dd className="text-ink">{columnsLabel(selected)}</dd>
              <dt className="text-muted">References</dt>
              <dd className="text-ink">{selected.references}</dd>
              {selected.authorKit && (
                <>
                  <dt className="text-muted">Needs</dt>
                  <dd className="text-ink">{selected.authorKit} from the publisher's author kit</dd>
                </>
              )}
            </dl>

            <h3 className="mt-4 text-sm font-semibold text-ink">The starting project includes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-body">
              {selected.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              <button type="button" className={buttonPrimary} onClick={() => useTemplate(selected)}>
                Use this template
              </button>
            </div>
          </>
        )}
      </Dialog>
    </PageContainer>
  )
}
