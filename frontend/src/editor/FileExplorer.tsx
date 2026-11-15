import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  FileImage,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  Upload,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
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
  onDelete?: (path: string) => void
  onUpload?: (files: FileList | File[], targetFolder?: string) => Promise<void>
}

type Adding = { kind: 'file' | 'folder'; parent: string } | null
interface ContextMenuState {
  x: number
  y: number
  path: string
  isDir: boolean
}

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name)

function iconFor(path: string) {
  if (path.endsWith('.bib')) return BookMarked
  if (/\.(pdf|png|jpe?g|eps|svg)$/i.test(path)) return FileImage
  return FileText
}

export function FileExplorer({ paths, folders, activePath, rootFile, onOpen, onCreateFile, onCreateFolder, onDelete, onUpload }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  /** Folder that new items go into: the last folder clicked, or the open file's folder. */
  const [targetFolder, setTargetFolder] = useState<string | null>(null)
  const [adding, setAdding] = useState<Adding>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Overleaf-style context menu & deletion dialog
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ path: string; isDir: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleClick, true)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleClick, true)
    }
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 120)
    setContextMenu({ x, y, path, isDir })
  }

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
              <div
                onContextMenu={(e) => handleContextMenu(e, f, true)}
                className={cn(
                  'group flex w-full items-center rounded-md text-left text-[13px] text-body hover:bg-line/50 hover:text-ink',
                  targetFolder === f && 'text-ink',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(f)}
                  aria-expanded={open}
                  style={pad}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left"
                >
                  <Chevron className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">{baseName(f)}</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete({ path: f, isDir: true })
                    }}
                    aria-label={`Delete ${baseName(f)}`}
                    title="Delete folder"
                    className="mr-1.5 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-red-500/10 hover:text-red-500 group-hover:inline-flex"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
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
      <li key={path}>
        <div
          onContextMenu={(e) => handleContextMenu(e, path, false)}
          className={cn(
            'group flex w-full items-center rounded-md pr-1 transition-colors',
            active ? 'bg-raised font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-body hover:bg-line/50 hover:text-ink',
          )}
        >
          <button
            type="button"
            onClick={() => {
              setTargetFolder(null)
              onOpen(path)
            }}
            aria-current={active ? 'true' : undefined}
            style={pad}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px]"
          >
            <span className="w-3.5 shrink-0" />
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted')} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{baseName(path)}</span>
            {path === rootFile && <span className="ml-auto mr-1 shrink-0 text-[11px] font-normal text-muted">root</span>}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDelete({ path, isDir: false })
              }}
              aria-label={`Delete ${baseName(path)}`}
              title="Delete file"
              className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-red-500/10 hover:text-red-500 group-hover:inline-flex"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </li>
    )
  }

  const toolButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-line/60 hover:text-ink'

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUpload) {
      void onUpload(e.dataTransfer.files, targetFolder || undefined)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-full min-h-0 flex-col bg-surface relative select-none"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-2 pl-4">
        <h2 className="text-xs font-semibold text-ink">Files</h2>
        <div className="flex gap-0.5">
          {onUpload && (
            <button
              type="button"
              className={toolButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload files"
              title="Upload files (images, bib, tex)"
            >
              <Upload className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <button type="button" className={toolButton} onClick={() => startAdding('file')} aria-label="Add file" title="Add file">
            <FilePlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button type="button" className={toolButton} onClick={() => startAdding('folder')} aria-label="Add folder" title="Add folder">
            <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0 && onUpload) {
              void onUpload(e.target.files, targetFolder || undefined)
              e.target.value = ''
            }
          }}
          className="hidden"
        />
      </div>
      <nav aria-label="Project files" className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul>{renderFolder('', 0)}</ul>
      </nav>

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-2 z-40 flex flex-col items-center justify-center bg-accent-soft/95 border-2 border-dashed border-accent p-4 text-center rounded-lg backdrop-blur-xs pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <Upload className="h-8 w-8 text-accent animate-bounce" />
          <p className="mt-2 text-xs font-semibold text-ink">Drop files here to add to project</p>
          <p className="mt-0.5 text-[11px] text-muted">Figures, PDFs, BibTeX, LaTeX</p>
        </div>
      )}

      {/* Overleaf-style Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] rounded-lg border border-line bg-raised py-1 text-xs text-ink shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-line/60 px-3 py-1.5 font-medium text-muted truncate max-w-[200px]">
            {baseName(contextMenu.path)}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                const item = { path: contextMenu.path, isDir: contextMenu.isDir }
                setContextMenu(null)
                setConfirmDelete(item)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.isDir ? 'folder' : 'file'}`}
        description={`Are you sure you want to delete "${confirmDelete ? baseName(confirmDelete.path) : ''}"? ${
          confirmDelete?.isDir
            ? 'All files and folders inside will be permanently deleted.'
            : 'This action cannot be undone.'
        }`}
      >
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={() => {
              if (confirmDelete && onDelete) {
                onDelete(confirmDelete.path)
              }
              setConfirmDelete(null)
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Dialog>
    </div>
  )
}
