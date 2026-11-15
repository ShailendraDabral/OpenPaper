import { ChevronsDownUp, ChevronsUpDown, FileQuestion, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProject } from '../app/ProjectProvider'
import { backend, BackendError, type CompilerInfo, type FileEntry, type ProjectInfo } from '../backend'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { LogoMark } from '../components/ui/Logo'
import { Splitter, useStoredNumber } from '../components/ui/Splitter'
import { buttonPrimary } from '../components/ui/styles'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { BottomPanel } from '../editor/BottomPanel'
import { CodeEditor, type CodeEditorHandle, type CursorPosition } from '../editor/CodeEditor'
import { FileExplorer } from '../editor/FileExplorer'
import { findRootFile, isTextPath } from '../editor/fileTypes'
import { checkProject } from '../editor/latex/check'
import { allBibEntries, allLabels, expandInputs } from '../editor/latex/source'
import { computeLatexWordCount } from '../editor/latex/wordCount'
import type { CheckResult, Issue, ProjectFiles } from '../editor/latex/types'
import type { CompletionData } from '../editor/latexEditor'
import { PreviewPanel } from '../editor/PreviewPanel'
import { cn } from '../lib/cn'

/** What the editor last read from, or wrote to, the disk for one file. */
interface DiskState {
  content: string
  modifiedMs: number
}

interface Loaded {
  entries: FileEntry[]
  /** Text of every file that could be opened. */
  files: Record<string, string>
  disk: Record<string, DiskState>
  /** Why a text file could not be opened (too large, not UTF-8). */
  unreadable: Record<string, string>
  truncated: boolean
}

const AUTOSAVE_MS = 700
const RESCAN_MS = 4000
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

/** Read the project folder: the file list, and the text of every text file. */
async function loadProject(): Promise<Loaded> {
  const { entries, truncated } = await backend.listFiles()
  const loaded: Loaded = { entries, files: {}, disk: {}, unreadable: {}, truncated }
  const textFiles = entries.filter((e) => !e.isDir && isTextPath(e.path))
  await inBatches(textFiles, 8, async (entry) => {
    try {
      const file = await backend.readTextFile(entry.path)
      loaded.files[entry.path] = file.content
      loaded.disk[entry.path] = file
    } catch (e) {
      loaded.unreadable[entry.path] = messageOf(e)
    }
  })
  return loaded
}

export function WorkspacePage({ project }: { project: ProjectInfo }) {
  const { closeProject } = useProject()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadProject()
      .then((result) => !cancelled && setLoaded(result))
      .catch((e) => !cancelled && setError(messageOf(e)))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <h1 className="font-serif text-3xl font-medium text-ink">This project could not be opened</h1>
        <p className="mt-3 leading-relaxed text-body">{error}</p>
        <Button variant="secondary" className="mt-6" onClick={closeProject}>
          Back to projects
        </Button>
      </div>
    )
  }
  if (!loaded) return <p className="p-8 text-sm text-muted">Reading {project.name}…</p>
  return <Workspace project={project} initial={loaded} />
}

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error'

function Workspace({ project, initial }: { project: ProjectInfo; initial: Loaded }) {
  const { closeProject } = useProject()

  /* ------------------------------- State ------------------------------- */

  const [entries, setEntries] = useState(initial.entries)
  const [files, setFiles] = useState(initial.files)
  const unreadable = initial.unreadable
  const firstFile = useMemo(() => findRootFile(initial.files) ?? Object.keys(initial.files).sort()[0] ?? null, [initial.files])
  const [tabs, setTabs] = useState<string[]>(firstFile ? [firstFile] : [])
  const [active, setActive] = useState<string | null>(firstFile)
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
  const [reveal, setReveal] = useState<{ path: string; line: number; nonce: number }>()

  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  /** Files changed both here and on disk; the user decides which version wins. */
  const [conflicts, setConflicts] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const [explorerOpen, setExplorerOpen] = useState(true)
  const [bottomOpen, setBottomOpen] = useState(true)
  const [explorerWidth, setExplorerWidth] = useStoredNumber('openpaper-explorer-width', 240)
  const [previewWidth, setPreviewWidth] = useStoredNumber('openpaper-preview-width', 520)
  const [bottomHeight, setBottomHeight] = useStoredNumber('openpaper-bottom-height', 190)

  const editor = useRef<CodeEditorHandle>(null)
  const filesRef = useRef(files)
  filesRef.current = files
  const disk = useRef(initial.disk)
  const conflictsRef = useRef(conflicts)
  conflictsRef.current = conflicts
  const busy = useRef(false) // a save or rescan is running; they must not overlap

  const isDirty = (path: string) => filesRef.current[path] !== undefined && filesRef.current[path] !== disk.current[path]?.content
  const dirtyPaths = () => Object.keys(filesRef.current).filter((p) => isDirty(p) && !conflictsRef.current.includes(p))

  /* -------------------------------- Saving -------------------------------- */

  /** Write every changed file to disk. Files changed elsewhere become conflicts instead of being overwritten. */
  const save = useCallback(async () => {
    if (busy.current) return
    const paths = dirtyPaths()
    if (paths.length === 0) return
    busy.current = true
    setSaveState('saving')
    let failure = ''
    for (const path of paths) {
      const content = filesRef.current[path]
      try {
        const modifiedMs = await backend.writeTextFile(path, content, disk.current[path]?.modifiedMs)
        disk.current[path] = { content, modifiedMs }
      } catch (e) {
        if (e instanceof BackendError && e.kind === 'conflict') setConflicts((list) => (list.includes(path) ? list : [...list, path]))
        else failure = messageOf(e)
      }
    }
    busy.current = false
    setSaveError(failure)
    setSaveState(failure ? 'error' : dirtyPaths().length > 0 ? 'unsaved' : 'saved')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChange = useCallback((path: string, value: string) => {
    setFiles((f) => ({ ...f, [path]: value }))
    setSaveState('unsaved')
  }, [])

  // Autosave shortly after the last keystroke; `saveState` in the dependencies
  // re-arms the timer when typing continued during a save.
  useEffect(() => {
    if (saveState !== 'unsaved') return
    const timer = window.setTimeout(save, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [files, saveState, save])

  // Save at once when the window loses focus or the workspace closes.
  useEffect(() => {
    const flush = () => void save()
    window.addEventListener('blur', flush)
    return () => {
      window.removeEventListener('blur', flush)
      flush()
    }
  }, [save])

  /* ------------------------ Changes made elsewhere ------------------------ */

  /** Compare the folder with what the editor holds, and pick up changes made by other programs. */
  const rescan = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const listing = await backend.listFiles()
      const onDisk = new Map(listing.entries.filter((e) => !e.isDir).map((e) => [e.path, e]))
      const updates: Record<string, string> = {}
      const removed: string[] = []
      const conflicted: string[] = []

      for (const path of Object.keys(disk.current)) {
        const entry = onDisk.get(path)
        if (entry && entry.modifiedMs === disk.current[path].modifiedMs) continue
        if (isDirty(path)) {
          conflicted.push(path) // changed or deleted elsewhere while edited here
        } else if (!entry) {
          removed.push(path)
        } else {
          const file = await backend.readTextFile(path).catch(() => null)
          if (file) {
            disk.current[path] = file
            updates[path] = file.content
          }
        }
      }
      // Text files that appeared since the last look.
      for (const [path, entry] of onDisk) {
        if (disk.current[path] || !isTextPath(entry.path)) continue
        const file = await backend.readTextFile(path).catch(() => null)
        if (file) {
          disk.current[path] = file
          updates[path] = file.content
        }
      }

      setEntries(listing.entries)
      if (Object.keys(updates).length > 0 || removed.length > 0) {
        for (const path of removed) delete disk.current[path]
        setFiles((f) => {
          const next = { ...f, ...updates }
          for (const path of removed) delete next[path]
          return next
        })
        for (const [path, content] of Object.entries(updates)) editor.current?.replaceContent(path, content)
        if (removed.length > 0) {
          setTabs((t) => t.filter((p) => !removed.includes(p)))
          setActive((a) => (a && removed.includes(a) ? null : a))
          setNotice(`${removed.map(baseName).join(', ')} ${removed.length === 1 ? 'was' : 'were'} deleted outside OpenPaper.`)
        }
      }
      if (conflicted.length > 0) setConflicts((list) => [...new Set([...list, ...conflicted])])
    } catch {
      /* the folder could not be read this time; the next scan tries again */
    } finally {
      busy.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onFocus = () => void rescan()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void rescan(), RESCAN_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [rescan])

  /** Settle a conflict: take the version on disk, or keep the version in the editor. */
  const resolveConflict = async (path: string, keep: 'mine' | 'disk') => {
    try {
      if (keep === 'mine') {
        const content = filesRef.current[path]
        const modifiedMs = await backend.writeTextFile(path, content)
        disk.current[path] = { content, modifiedMs }
      } else {
        const file = await backend.readTextFile(path).catch(() => null)
        if (file) {
          disk.current[path] = file
          setFiles((f) => ({ ...f, [path]: file.content }))
          editor.current?.replaceContent(path, file.content)
        } else {
          // Deleted on disk: drop it from the editor too.
          delete disk.current[path]
          setFiles((f) => {
            const next = { ...f }
            delete next[path]
            return next
          })
          setTabs((t) => t.filter((p) => p !== path))
          setActive((a) => (a === path ? null : a))
        }
      }
      setConflicts((list) => list.filter((p) => p !== path))
      setSaveState(dirtyPaths().filter((p) => p !== path).length > 0 ? 'unsaved' : 'saved')
    } catch (e) {
      setSaveError(messageOf(e))
      setSaveState('error')
    }
  }

  /* --------------------------- Files and folders --------------------------- */

  const openFile = useCallback((path: string) => {
    setTabs((t) => (t.includes(path) ? t : [...t, path]))
    setActive(path)
  }, [])

  const closeTab = (path: string) => {
    const next = tabs.filter((t) => t !== path)
    setTabs(next)
    if (active === path) setActive(next[Math.max(0, tabs.indexOf(path) - 1)] ?? null)
  }

  const createFile = async (path: string) => {
    try {
      const modifiedMs = await backend.createFile(path)
      if (isTextPath(path)) {
        disk.current[path] = { content: '', modifiedMs }
        setFiles((f) => ({ ...f, [path]: '' }))
      }
      setEntries((await backend.listFiles()).entries)
      openFile(path)
    } catch (e) {
      setNotice(messageOf(e))
    }
  }

  const createFolder = async (path: string) => {
    try {
      await backend.createFolder(path)
      setEntries((await backend.listFiles()).entries)
    } catch (e) {
      setNotice(messageOf(e))
    }
  }

  const deleteFileOrFolder = async (path: string) => {
    try {
      await backend.deleteFile(path)
      const prefix = path.endsWith('/') ? path : `${path}/`
      const affected = (p: string) => p === path || p.startsWith(prefix)

      for (const k of Object.keys(disk.current)) {
        if (affected(k)) delete disk.current[k]
      }
      setFiles((f) => {
        const next = { ...f }
        for (const k of Object.keys(next)) {
          if (affected(k)) delete next[k]
        }
        return next
      })

      setTabs((prevTabs) => {
        const nextTabs = prevTabs.filter((t) => !affected(t))
        if (active && affected(active)) {
          const fallback = nextTabs[0] ?? null
          setActive(fallback)
        }
        return nextTabs
      })

      const listing = await backend.listFiles()
      setEntries(listing.entries)
    } catch (e) {
      setNotice(messageOf(e))
    }
  }

  const uploadFiles = async (fileList: FileList | File[], targetFolder?: string) => {
    const list = Array.from(fileList)
    if (list.length === 0) return
    try {
      let count = 0
      for (const f of list) {
        const relPath = targetFolder ? `${targetFolder}/${f.name}` : f.name
        if (isTextPath(f.name)) {
          const text = await f.text()
          const modifiedMs = await backend.writeTextFile(relPath, text)
          disk.current[relPath] = { content: text, modifiedMs }
          setFiles((prev) => ({ ...prev, [relPath]: text }))
        } else {
          const buffer = await f.arrayBuffer()
          await backend.writeBinaryFile(relPath, new Uint8Array(buffer))
        }
        count++
      }
      const listing = await backend.listFiles()
      setEntries(listing.entries)
      setNotice(`Uploaded ${count} file${count === 1 ? '' : 's'} successfully.`)
    } catch (e) {
      setNotice(messageOf(e))
    }
  }

  const handleRevealPdf = async () => {
    if (!rootFile) return
    const pdfName = rootFile.replace(/\.tex$/i, '.pdf')
    await backend.revealFile(pdfName)
  }

  const leave = async () => {
    await save()
    await closeProject()
  }

  /* --------------------------- Checks and preview --------------------------- */

  const filePaths = useMemo(() => entries.filter((e) => !e.isDir).map((e) => e.path), [entries])
  const folderPaths = useMemo(() => entries.filter((e) => e.isDir).map((e) => e.path), [entries])
  const projectFiles = useMemo<ProjectFiles>(() => Object.fromEntries(filePaths.map((p) => [p, files[p] ?? null])), [filePaths, files])
  const rootFile = useMemo(() => findRootFile(projectFiles), [projectFiles])
  const projectRef = useRef({ projectFiles, rootFile })
  projectRef.current = { projectFiles, rootFile }

  const [result, setResult] = useState<CheckResult>(() => checkProject(projectFiles, rootFile))
  useEffect(() => {
    const timer = window.setTimeout(() => setResult(checkProject(projectFiles, rootFile)), 400)
    return () => window.clearTimeout(timer)
  }, [projectFiles, rootFile])

  const [showWordCount, setShowWordCount] = useState(false)
  const wordCount = useMemo(() => {
    if (!rootFile || typeof files[rootFile] !== 'string') return null
    const expanded = expandInputs(projectFiles, rootFile) || files[rootFile]
    return computeLatexWordCount(expanded)
  }, [files, projectFiles, rootFile])

  /* ------------------------------- Compiler ------------------------------- */

  const [detectedCompilers, setDetectedCompilers] = useState<CompilerInfo[]>([])
  const [selectedCompiler, setSelectedCompiler] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [compilerLog, setCompilerLog] = useState<string>('')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [installingTectonic, setInstallingTectonic] = useState(false)

  const refreshCompilers = useCallback(async () => {
    try {
      const list = await backend.detectCompilers()
      setDetectedCompilers(list)
      if (list.length > 0) {
        setSelectedCompiler((prev) => prev || list[0].path)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshCompilers()
  }, [refreshCompilers])

  // Try loading existing compiled PDF on load or rootFile change
  useEffect(() => {
    if (!rootFile) return
    const pdfName = rootFile.replace(/\.tex$/i, '.pdf')
    let cancelled = false
    backend
      .readPdf(pdfName)
      .then((bytes) => {
        if (!cancelled && bytes && bytes.length > 0) {
          const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
          setPdfUrl(URL.createObjectURL(blob))
        }
      })
      .catch(() => {
        /* PDF not present yet */
      })
    return () => {
      cancelled = true
    }
  }, [rootFile])

  const compile = useCallback(async () => {
    if (compiling || !rootFile) return
    await save()
    setCompiling(true)
    setCompileError(null)

    try {
      const out = await backend.compileProject(rootFile, selectedCompiler || undefined)
      setDurationMs(out.durationMs)
      setCompilerLog(out.log)

      if (out.pdfFilename) {
        const bytes = await backend.readPdf(out.pdfFilename)
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }

      if (!out.success) {
        setCompileError('Compilation failed. Check the Log tab below for compiler output.')
      }
    } catch (err) {
      const msg = messageOf(err)
      setCompileError(msg)
      setCompilerLog((prev) => (prev ? `${prev}\n\nError: ${msg}` : `Error: ${msg}`))
    } finally {
      setCompiling(false)
    }
  }, [compiling, rootFile, save, selectedCompiler])

  const handleInstallTectonic = useCallback(async () => {
    setInstallingTectonic(true)
    try {
      await backend.installTectonic()
      await refreshCompilers()
    } catch (err) {
      setNotice(`Failed to install Tectonic: ${messageOf(err)}`)
    } finally {
      setInstallingTectonic(false)
    }
  }, [refreshCompilers])

  // Keyboard shortcut: Ctrl+B or Ctrl+Enter to compile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'Enter')) {
        e.preventDefault()
        void compile()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compile])

  const jumpTo = (issue: Issue) => {
    if (files[issue.file] === undefined) return
    openFile(issue.file)
    setReveal({ path: issue.file, line: issue.line, nonce: Date.now() })
  }

  const getCompletionData = useCallback((): CompletionData => {
    const { projectFiles: f, rootFile: root } = projectRef.current
    const paths = Object.keys(f)
    const tex = paths.filter((p) => p.endsWith('.tex'))
    return {
      citations: allBibEntries(f).map((e) => ({
        key: e.key,
        title: e.fields.title ?? '',
        author: e.fields.author,
        year: e.fields.year,
      })),
      labels: allLabels(f, tex),
      texFiles: tex.filter((p) => p !== root),
      figureFiles: paths.filter((p) => /\.(pdf|png|jpe?g|eps)$/i.test(p)),
    }
  }, [])

  /* -------------------------------- Layout -------------------------------- */

  const activeText = active ? files[active] : undefined
  const editable = active !== null && activeText !== undefined
  const editorPath = editable ? active : null
  const toolButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-body hover:bg-surface hover:text-ink disabled:opacity-40'
  const conflict = conflicts[0]

  const saveLabel: Record<SaveState, string> = {
    saved: 'All changes saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    error: 'Could not save',
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas text-body">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
        <button type="button" onClick={leave} className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-body hover:bg-surface hover:text-ink">
          <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Projects
        </button>
        <span className="h-5 w-px bg-line" aria-hidden="true" />
        <LogoMark className="h-6 w-6 shrink-0 dark:rounded-[7px] dark:ring-1 dark:ring-line" />
        <h1 className="shrink-0 text-sm font-semibold text-ink">{project.name}</h1>
        <span className="min-w-0 truncate font-mono text-xs text-muted" title={project.path}>
          {project.path}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span
            role="status"
            title={saveError || undefined}
            className={cn('text-xs', saveState === 'error' ? 'text-[#b3261e] dark:text-[#f2b8b5]' : 'text-muted')}
          >
            {saveState === 'error' && saveError ? saveError : saveLabel[saveState]}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {(notice || initial.truncated) && (
        <div role="status" className="flex shrink-0 items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-ink">
          <p className="min-w-0 flex-1">{notice || 'This folder has more files than OpenPaper lists. Some are not shown.'}</p>
          {notice && (
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" className="rounded p-0.5 text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: project explorer */}
        {explorerOpen && (
          <>
            <aside aria-label="Project explorer" className="min-h-0 shrink-0" style={{ width: explorerWidth }}>
              <FileExplorer
                paths={filePaths}
                folders={folderPaths}
                activePath={active ?? ''}
                rootFile={rootFile}
                onOpen={openFile}
                onCreateFile={createFile}
                onCreateFolder={createFolder}
                onDelete={deleteFileOrFolder}
                onUpload={uploadFiles}
              />
            </aside>
            <Splitter orientation="vertical" label="Resize project explorer" onResize={(d) => setExplorerWidth((w) => clamp(w + d, 160, 480))} />
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {/* Centre: editor */}
            <section aria-label="Editor" className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex h-10 shrink-0 items-center border-b border-line">
                <button
                  type="button"
                  className={cn(toolButton, 'mx-1')}
                  onClick={() => setExplorerOpen((o) => !o)}
                  aria-label={explorerOpen ? 'Hide project explorer' : 'Show project explorer'}
                  title={explorerOpen ? 'Hide project explorer' : 'Show project explorer'}
                >
                  {explorerOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </button>

                <div role="tablist" aria-label="Open files" className="flex h-full min-w-0 flex-1 overflow-x-auto">
                  {tabs.map((path) => (
                    <div
                      key={path}
                      className={cn(
                        'flex h-full shrink-0 items-center border-r border-line text-[13px] first:border-l',
                        path === active ? 'bg-canvas text-ink shadow-[inset_0_-2px_0_var(--accent)]' : 'bg-surface text-body',
                      )}
                    >
                      <button type="button" role="tab" aria-selected={path === active} onClick={() => setActive(path)} title={path} className="h-full pr-1 pl-3 font-mono">
                        {baseName(path)}
                      </button>
                      <button type="button" onClick={() => closeTab(path)} aria-label={`Close ${baseName(path)}`} className="mr-1.5 rounded p-0.5 text-muted hover:bg-line hover:text-ink">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-0.5 px-1">
                  <button type="button" className={toolButton} disabled={!editable} onClick={() => editor.current?.openSearch()} aria-label="Search in file" title="Search (Ctrl+F)">
                    <Search className="h-4 w-4" />
                  </button>
                  <button type="button" className={toolButton} disabled={!editable} onClick={() => editor.current?.foldAll()} aria-label="Fold all" title="Fold all">
                    <ChevronsDownUp className="h-4 w-4" />
                  </button>
                  <button type="button" className={toolButton} disabled={!editable} onClick={() => editor.current?.unfoldAll()} aria-label="Unfold all" title="Unfold all">
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 bg-[var(--code-bg)]">
                {editorPath !== null ? (
                  <CodeEditor
                    ref={editor}
                    path={editorPath}
                    value={files[editorPath]}
                    onChange={onChange}
                    onCursor={setCursor}
                    onSave={save}
                    getCompletionData={getCompletionData}
                    reveal={reveal}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <FileQuestion className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
                    {active ? (
                      <>
                        <p className="font-mono text-sm text-ink">{active}</p>
                        <p className="max-w-sm text-sm text-body">
                          {unreadable[active] ?? 'This is not a text file, so it cannot be edited here. It is still part of the project.'}
                        </p>
                      </>
                    ) : (
                      <p className="max-w-sm text-sm text-body">
                        {filePaths.length === 0 ? 'This folder is empty. Add a file from the project explorer.' : 'Choose a file in the project explorer.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-xs text-muted">
                {editable && (
                  <>
                    <span className="tabular-nums">
                      Line {cursor.line}, column {cursor.column}
                    </span>
                    <span>{active.endsWith('.bib') ? 'BibTeX' : active.endsWith('.tex') ? 'LaTeX' : 'Plain text'}</span>
                  </>
                )}
                {wordCount && (
                  <button
                    type="button"
                    onClick={() => setShowWordCount(true)}
                    className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-body hover:bg-line/40 hover:text-ink transition-colors cursor-pointer"
                    title="View academic word count breakdown"
                  >
                    <span className="font-semibold text-ink tabular-nums">{wordCount.totalWords.toLocaleString()}</span> words
                  </button>
                )}
                <span className="ml-auto hidden lg:inline">Saved automatically. Type \ for suggestions.</span>
              </div>
            </section>

            <Splitter orientation="vertical" label="Resize preview" onResize={(d) => setPreviewWidth((w) => clamp(w - d, 260, 1200))} />

            {/* Right: preview */}
            <section aria-label="Preview" className="min-h-0 shrink-0" style={{ width: previewWidth, maxWidth: '60%' }}>
              <PreviewPanel
                blocks={result.blocks}
                rootFile={rootFile}
                pdfUrl={pdfUrl}
                compiling={compiling}
                compileError={compileError}
                durationMs={durationMs}
                onCompile={compile}
                detectedCompilers={detectedCompilers}
                selectedCompiler={selectedCompiler}
                onSelectCompiler={setSelectedCompiler}
                onInstallTectonic={handleInstallTectonic}
                installingTectonic={installingTectonic}
                onRevealPdf={handleRevealPdf}
              />
            </section>
          </div>

          {/* Bottom: diagnostics */}
          {bottomOpen && <Splitter orientation="horizontal" label="Resize diagnostics" onResize={(d) => setBottomHeight((h) => clamp(h - d, 100, 520))} />}
          <section aria-label="Diagnostics" className={cn('shrink-0', !bottomOpen && 'border-t border-line')} style={{ height: bottomOpen ? bottomHeight : 36 }}>
            <BottomPanel
              result={result}
              compilerLog={compilerLog}
              rootFile={rootFile}
              open={bottomOpen}
              onToggle={() => setBottomOpen((o) => !o)}
              onJump={jumpTo}
            />
          </section>
        </div>
      </div>

      <Dialog
        open={conflict !== undefined}
        onClose={() => undefined}
        dismissible={false}
        title={conflict ? `${baseName(conflict)} changed outside OpenPaper` : ''}
        description="Another program changed or removed this file while it had unsaved edits here. Nothing has been overwritten. Choose which version to keep."
      >
        {conflict && (
          <>
            <p className="font-mono text-xs text-muted">{conflict}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => resolveConflict(conflict, 'disk')}>
                Use the version on disk
              </Button>
              <button type="button" className={buttonPrimary} onClick={() => resolveConflict(conflict, 'mine')}>
                Keep my version
              </button>
            </div>
          </>
        )}
      </Dialog>

      {/* Academic Word Count Modal */}
      <Dialog
        open={showWordCount}
        onClose={() => setShowWordCount(false)}
        title="Document Word Count"
        description="Comprehensive academic breakdown calculated across the active manuscript."
      >
        {wordCount && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-surface p-3 text-center">
                <span className="text-2xl font-bold text-accent tabular-nums">{wordCount.totalWords.toLocaleString()}</span>
                <p className="mt-0.5 text-xs text-muted">Total Words</p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3 text-center">
                <span className="text-2xl font-bold text-ink tabular-nums">{wordCount.textWords.toLocaleString()}</span>
                <p className="mt-0.5 text-xs text-muted">Text Body Words</p>
              </div>
            </div>

            <div className="divide-y divide-line rounded-lg border border-line bg-surface text-xs">
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-body">Section Headings</span>
                <span className="font-medium text-ink tabular-nums">{wordCount.headerWords.toLocaleString()} words</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-body">Captions</span>
                <span className="font-medium text-ink tabular-nums">{wordCount.captionWords.toLocaleString()} words</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-body">Math Displays & Equations</span>
                <span className="font-medium text-ink tabular-nums">{wordCount.mathDisplays}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-body">Figures</span>
                <span className="font-medium text-ink tabular-nums">{wordCount.figureCount}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-body">Tables</span>
                <span className="font-medium text-ink tabular-nums">{wordCount.tableCount}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowWordCount(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
