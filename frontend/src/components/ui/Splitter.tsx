import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

interface Props {
  /** 'vertical' is a vertical bar between side-by-side panels; 'horizontal' sits between stacked panels. */
  orientation: 'vertical' | 'horizontal'
  /** Called while dragging (and for arrow keys) with the movement in pixels: right and down are positive. */
  onResize: (delta: number) => void
  label: string
}

/** A draggable divider between two panels. Also works with the arrow keys when focused. */
export function Splitter({ orientation, onResize, label }: Props) {
  const vertical = orientation === 'vertical'

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    let last = vertical ? e.clientX : e.clientY
    const move = (ev: PointerEvent) => {
      const now = vertical ? ev.clientX : ev.clientY
      onResize(now - last)
      last = now
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = vertical ? 'col-resize' : 'row-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={(e) => {
        const step = e.key === (vertical ? 'ArrowRight' : 'ArrowDown') ? 16 : e.key === (vertical ? 'ArrowLeft' : 'ArrowUp') ? -16 : 0
        if (step) {
          e.preventDefault()
          onResize(step)
        }
      }}
      className={cn(
        'shrink-0 border-line bg-surface transition-colors hover:bg-accent/40 focus-visible:bg-accent/40',
        vertical ? 'w-1.5 cursor-col-resize border-x' : 'h-1.5 cursor-row-resize border-y',
      )}
    />
  )
}

/** A number kept in local storage, for panel sizes that should survive a restart. */
export function useStoredNumber(key: string, initial: number): [number, (update: (value: number) => number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key))
      return Number.isFinite(stored) && stored > 0 ? stored : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, String(Math.round(value)))
    } catch {
      /* not remembered this time */
    }
  }, [key, value])
  return [value, (update) => setValue(update)]
}
