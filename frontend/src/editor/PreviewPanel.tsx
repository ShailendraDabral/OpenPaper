import { AlertCircle, Download, Eye, FileText, FolderOpen, Loader2, Minus, Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CompilerInfo } from '../backend'
import { cn } from '../lib/cn'
import type { Block } from './latex/types'
import { PdfDocument } from './PdfDocument'

const ZOOMS = [50, 75, 100, 125, 150, 200]

interface Props {
  blocks: Block[]
  rootFile: string | null
  pdfUrl: string | null
  compiling: boolean
  compileError: string | null
  durationMs: number | null
  onCompile: () => void
  detectedCompilers: CompilerInfo[]
  selectedCompiler: string | null
  onSelectCompiler: (path: string) => void
  onInstallTectonic: () => void
  installingTectonic: boolean
  onRevealPdf?: () => void
}

/**
 * Right-hand panel: Displays either the compiled PDF output or the instant draft preview.
 */
export function PreviewPanel({
  blocks,
  rootFile,
  pdfUrl,
  compiling,
  compileError,
  durationMs,
  onCompile,
  detectedCompilers,
  selectedCompiler,
  onSelectCompiler,
  onInstallTectonic,
  installingTectonic,
  onRevealPdf,
}: Props) {
  const [zoom, setZoom] = useState(100)
  const [mode, setMode] = useState<'pdf' | 'draft'>('pdf')

  // Auto-switch to PDF view when a PDF becomes available
  useEffect(() => {
    if (pdfUrl) {
      setMode('pdf')
    }
  }, [pdfUrl])

  const step = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))])
  const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-surface hover:text-ink disabled:opacity-40'

  const hasCompiler = detectedCompilers.length > 0
  const activeCompiler = detectedCompilers.find((c) => c.path === selectedCompiler) || detectedCompilers[0]

  const handleDownloadPdf = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = rootFile ? rootFile.replace(/\.tex$/i, '.pdf') : 'document.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Header bar */}
      <div className="flex h-10 shrink-0 items-center border-b border-line px-3 gap-2">
        {/* Mode selector pills */}
        <div className="flex items-center rounded-md bg-surface p-0.5 border border-line text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('pdf')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors',
              mode === 'pdf' ? 'bg-canvas text-ink shadow-sm font-semibold' : 'text-muted hover:text-ink',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
            {pdfUrl && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="PDF ready" />}
          </button>
          <button
            type="button"
            onClick={() => setMode('draft')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors',
              mode === 'draft' ? 'bg-canvas text-ink shadow-sm font-semibold' : 'text-muted hover:text-ink',
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Draft
          </button>
        </div>

        {/* Compiler selection if multiple available */}
        {detectedCompilers.length > 1 && (
          <select
            value={selectedCompiler || activeCompiler?.path || ''}
            onChange={(e) => onSelectCompiler(e.target.value)}
            disabled={compiling}
            className="text-xs bg-surface border border-line rounded px-2 py-1 text-ink focus:outline-none"
            title="Choose LaTeX Compiler"
          >
            {detectedCompilers.map((c) => (
              <option key={c.path} value={c.path}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Compile button */}
        <button
          type="button"
          onClick={onCompile}
          disabled={compiling || !rootFile || (!hasCompiler && !installingTectonic)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium shadow-sm transition-all',
            compiling
              ? 'bg-amber-600/20 text-amber-500 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-emerald-600',
          )}
          title="Compile LaTeX (Ctrl+B / Ctrl+Enter)"
        >
          {compiling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Compiling…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Compile
            </>
          )}
        </button>

        {/* Duration / Status indicator */}
        {durationMs !== null && !compiling && (
          <span className="hidden xl:inline text-[11px] text-muted tabular-nums" title="Last compile duration">
            {durationMs}ms
          </span>
        )}

        {/* Right side controls: Download PDF & Zoom */}
        <div className="ml-auto flex items-center gap-1.5">
          {mode === 'draft' && (
            <>
              <button type="button" className={iconButton} onClick={() => step(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs text-body tabular-nums">{zoom}%</span>
              <button type="button" className={iconButton} onClick={() => step(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in">
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
          {mode === 'pdf' && pdfUrl && (
            <>
              {onRevealPdf && (
                <button
                  type="button"
                  onClick={onRevealPdf}
                  className={iconButton}
                  title="Show PDF file in folder"
                  aria-label="Show PDF file in folder"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 transition-all active:scale-95"
                title="Download compiled PDF"
                aria-label="Download compiled PDF"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode content */}
      {mode === 'pdf' ? (
        pdfUrl ? (
          /* Real PDF output rendered via webview native PDF engine */
          <div className="relative min-h-0 flex-1 w-full bg-[#525659]">
            <iframe
              src={pdfUrl}
              key={pdfUrl}
              className="h-full w-full border-none"
              title="Compiled PDF Document"
            />
          </div>
        ) : (
          /* Empty / Prompt state when PDF is not compiled yet */
          <div className="min-h-0 flex-1 overflow-auto bg-surface p-6 flex flex-col items-center justify-center text-center">
            <div className="max-w-md flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center text-ink">
                <FileText className="h-6 w-6 text-muted" />
              </div>

              <div>
                <h3 className="font-semibold text-ink text-base">
                  {hasCompiler ? 'PDF Not Compiled Yet' : 'LaTeX Compiler Required'}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-body">
                  {hasCompiler
                    ? `Click the "Compile" button above (or press Ctrl+Enter) to build a real PDF using ${activeCompiler?.name || 'LaTeX'}.`
                    : 'To produce a real PDF, OpenPaper needs a local LaTeX compiler like Tectonic, MiKTeX, or TeX Live.'}
                </p>
              </div>

              {!hasCompiler && (
                <div className="rounded-lg border border-line bg-canvas p-4 text-left text-xs w-full mt-2">
                  <div className="flex items-start gap-2.5">
                    <Download className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-ink">Recommended: Tectonic Compiler</p>
                      <p className="mt-1 text-muted">
                        Lightweight (~20MB), self-contained, and automatically downloads LaTeX packages on demand.
                      </p>
                      <button
                        type="button"
                        onClick={onInstallTectonic}
                        disabled={installingTectonic}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {installingTectonic ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Installing Tectonic…
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            Auto-Install Tectonic
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {compileError && (
                <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-left text-xs text-rose-700 dark:text-rose-300 w-full flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Compilation Failed</p>
                    <p className="mt-0.5 whitespace-pre-wrap font-mono text-[11px]">{compileError}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                {hasCompiler && (
                  <button
                    type="button"
                    onClick={onCompile}
                    disabled={compiling || !rootFile}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Compile Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('draft')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-3 py-2 text-xs font-medium text-ink hover:bg-surface"
                >
                  <Eye className="h-4 w-4" />
                  View Draft Preview
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Instant Draft Preview */
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="shrink-0 border-b border-line bg-surface px-4 py-1.5 text-xs leading-snug text-muted">
            Instant draft preview drawn from LaTeX syntax as you type. Switch to "PDF" tab to view real compiler output.
          </p>
          <div className="min-h-0 flex-1 overflow-auto bg-surface p-4 sm:p-6">
            <div className="mx-auto" style={{ width: `${zoom}%`, maxWidth: `${(zoom / 100) * 52}rem` }}>
              <PdfDocument blocks={blocks} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
