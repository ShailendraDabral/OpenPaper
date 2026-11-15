import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Block } from './latex/types'
import { PdfDocument } from './PdfDocument'

const ZOOMS = [50, 75, 100, 125, 150, 200]

/**
 * Right-hand panel. Until the LaTeX compiler is built, it shows a draft that
 * OpenPaper draws from the source, and says so. The compiled PDF replaces it.
 */
export function PreviewPanel({ blocks }: { blocks: Block[] }) {
  const [zoom, setZoom] = useState(100)
  const step = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))])
  const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-body hover:bg-surface hover:text-ink disabled:opacity-40'

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex h-10 shrink-0 items-center border-b border-line pr-2 pl-4">
        <h2 className="text-xs font-semibold text-ink">Draft preview</h2>
        <div className="ml-auto flex items-center">
          <button type="button" className={iconButton} onClick={() => step(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-11 text-center text-xs text-body tabular-nums">{zoom}%</span>
          <button type="button" className={iconButton} onClick={() => step(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="shrink-0 border-b border-line bg-surface px-4 py-1.5 text-xs leading-snug text-muted">
        Drawn by OpenPaper from your source as you type. This is not LaTeX output: this version does not compile yet,
        so no PDF is produced.
      </p>

      <div className="min-h-0 flex-1 overflow-auto bg-surface p-4 sm:p-6">
        <div className="mx-auto" style={{ width: `${zoom}%`, maxWidth: `${(zoom / 100) * 52}rem` }}>
          <PdfDocument blocks={blocks} />
        </div>
      </div>
    </div>
  )
}
