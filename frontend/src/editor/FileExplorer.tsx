import { BookMarked, ChevronDown, ChevronRight, FileImage, FilePlus, FileText, Folder, FolderOpen, FolderPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { cn } from '../lib/cn'

interface Props {
  /** Every file path in the project. */
  paths: string[]
  /** Every folder path, so empty folders can exist. */
  folders: string[]
  activePath: string
  /** The file LaTeX starts from, if the project has one. */
  rootFile: string | null
  onOpen: (path: string) => void
  onCreateFile: (path: string) => void
  onCreateFolder: (path: string) => void
}

type Adding = { kind: 'file' | 'folder'; parent: string } | null

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name)

function iconFor(path: string) {
  if (path.endsWith('.bib')) return BookMarked
  if (/\.(pdf|png|jpe?g|eps|svg)$/i.test(path)) return FileImage
  return FileText
}

export function FileExplorer({ paths, folders, activePath, rootFile, onOpen, onCreateFile, onCreateFolder }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  /** Folder that new items go into: the last folder clicked, or the open file's folder. */
  const [targetFolder, setTargetFolder] = useState<string | null>(null)
  const [adding, setAdding] = useState<Adding>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const startAdding = (kind: 'file' | 'folder') => {
    const parent = targetFolder ?? parentOf(activePath)
    setCollapsed((c) => {
      const next = new Set(c)
      next.delete(parent)
      return next
    })
    setAdding({ kind, parent })
    setName('')
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!adding) return
    let value = name.trim()
    if (!value) return setError('Enter a name.')
    if (!/^[A-Za-z0-9._-]+$/.test(value)) return setError('Use letters, numbers, dots, dashes and underscores.')
    if (adding.kind === 'file' && !value.includes('.')) value += '.tex'
    const path = join(adding.parent, value)
    if (paths.includes(path) || folders.includes(path)) return setError(`"${value}" already exists here.`)
    if (adding.kind === 'file') onCreateFile(path)
    else {
      onCreateFolder(path)
      setTargetFolder(path)
    }
    setAdding(null)
  }

  const toggle = (folder: string) => {
    setTargetFolder(folder)
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  const renderFolder = (folder: string, depth: number) => {
    const childFolders = folders.filter((f) => parentOf(f) === folder).sort()
    const childFiles = paths
      .filter((p) => parentOf(p) === folder)
      .sort((a, b) => (a === rootFile ? -1 : b === rootFile ? 1 : a.localeCompare(b)))
    const pad = { paddingLeft: `${depth * 14 + 8}px` }

    return (
      <>
        {adding?.parent === folder && (
          <li>
            <form onSubmit={submit} style={pad} className="py-1 pr-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                onBlur={() => !name.trim() && setAdding(null)}
                onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
                aria-label={adding.kind === 'file' ? 'New file name' : 'New folder name'}
                aria-invalid={!!error}
                placeholder={adding.kind === 'file' ? 'file.tex' : 'folder name'}
                className="h-7 w-full rounded border border-accent bg-canvas px-2 font-mono text-xs text-ink placeholder:text-muted"
              />
              {error && (
                <p role="alert" className="mt-1 text-xs leading-snug text-[#b3261e] dark:text-[#f2b8b5]">
                  {error}
                </p>
              )}
            </form>
          </li>
        )}
        {/* The root file leads; then folders; then the remaining files. */}
        {folder === '' && rootFile && childFiles.includes(rootFile) && <FileRow path={rootFile} pad={pad} />}
        {childFolders.map((f) => {
          const open = !collapsed.has(f)
          const Chevron = open ? ChevronDown : ChevronRight
          const Icon = open ? FolderOpen : Folder
          return (
            <li key={f}>
              <button
                type="button"
                onClick={() => toggle(f)}
                aria-expanded={open}
                style={pad}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] text-body hover:bg-line/50 hover:text-ink',
                  targetFolder === f && 'text-ink',
                )}
              >
                <Chevron className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{baseName(f)}</span>
              </button>
              {open && <ul>{renderFolder(f, depth + 1)}</ul>}
            </li>
          )
        })}
        {childFiles
          .filter((p) => !(folder === '' && p === rootFile))
          .map((p) => (
            <FileRow key={p} path={p} pad={pad} />
          ))}
        {folder !== '' && childFolders.length + childFiles.length === 0 && adding?.parent !== folder && (
          <li style={{ paddingLeft: `${depth * 14 + 30}px` }} className="py-1 text-xs text-muted">
            Empty
          </li>
        )}
      </>
    )
  }

  const FileRow = ({ path, pad }: { path: string; pad: { paddingLeft: string } }) => {
    const Icon = iconFor(path)
    const active = path === activePath
    return (
      <li>
        <button
          type="button"
          onClick={() => {
            setTargetFolder(null)
            onOpen(path)
          }}
          aria-current={active ? 'true' : undefined}
          style={pad}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px]',
            active ? 'bg-raised font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-body hover:bg-line/50 hover:text-ink',
          )}
        >
          <span className="w-3.5 shrink-0" />
          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted')} strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">{baseName(path)}</span>
          {path === rootFile && <span className="ml-auto shrink-0 text-[11px] font-normal text-muted">root</span>}
        </button>
      </li>
    )
  }

  const toolButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-line/60 hover:text-ink'

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-2 pl-4">
        <h2 className="text-xs font-semibold text-ink">Files</h2>
        <div className="flex gap-0.5">
          <button type="button" className={toolButton} onClick={() => startAdding('file')} aria-label="Add file" title="Add file">
            <FilePlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={toolButton} onClick={() => startAdding('folder')} aria-label="Add folder" title="Add folder">
            <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <nav aria-label="Project files" className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul>{renderFolder('', 0)}</ul>
      </nav>
    </div>
  )
}
