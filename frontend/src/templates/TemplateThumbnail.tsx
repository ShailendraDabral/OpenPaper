import { cn } from '../lib/cn'
import type { TemplateLayout } from './templates'

/** Miniature page drawn in CSS, one per template layout. */
const page = 'bg-white shadow-page ring-1 ring-black/5'
const ink = 'bg-[#c3ccda]'
const dark = 'bg-[#0b2545]'

function Lines({ n, className }: { n: number; className?: string }) {
  return (
    <div className={cn('space-y-[5px]', className)}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn('h-[3px] rounded-full', ink, i === n - 1 && 'w-3/5')} />
      ))}
    </div>
  )
}

export function TemplateThumbnail({ layout }: { layout: TemplateLayout }) {
  if (layout === 'slides') {
    return (
      <div className={cn(page, 'aspect-[16/10] w-[12rem] shrink-0 self-center rounded-[3px]')} aria-hidden="true">
        <div className={cn(dark, 'h-6 rounded-t-[3px]')} />
        <div className="p-4">
          <div className={cn(dark, 'h-[5px] w-1/2 rounded-full')} />
          <Lines n={3} className="mt-4 w-3/4" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(page, 'h-full w-[11.5rem] rounded-t-[3px] px-5 pt-6')} aria-hidden="true">
      {layout === 'thesis' && (
        <div className="flex flex-col items-center pt-8">
          <div className={cn(dark, 'h-[6px] w-4/5 rounded-full')} />
          <div className={cn(dark, 'mt-2 h-[6px] w-3/5 rounded-full')} />
          <div className={cn(ink, 'mt-6 h-[3px] w-2/5 rounded-full')} />
          <div className="mt-8 h-8 w-8 rounded-full border-2 border-[#c3ccda]" />
        </div>
      )}
      {layout === 'single' && (
        <>
          <div className={cn(dark, 'mx-auto h-[5px] w-4/5 rounded-full')} />
          <div className={cn(ink, 'mx-auto mt-2 h-[3px] w-2/5 rounded-full')} />
          <Lines n={3} className="mx-4 mt-5" />
          <div className={cn(dark, 'mt-5 h-[4px] w-1/3 rounded-full')} />
          <Lines n={6} className="mt-3" />
        </>
      )}
      {layout === 'two-column' && (
        <>
          <div className={cn(dark, 'mx-auto h-[5px] w-4/5 rounded-full')} />
          <div className={cn(ink, 'mx-auto mt-2 h-[3px] w-2/5 rounded-full')} />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Lines n={10} />
            <div>
              <div className="mb-[5px] h-10 rounded-[2px] bg-[#e4e9f1]" />
              <Lines n={5} />
            </div>
          </div>
        </>
      )}
      {layout === 'proposal' && (
        <>
          <div className={cn(dark, 'h-[5px] w-3/5 rounded-full')} />
          <Lines n={4} className="mt-4" />
          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[2px] bg-[#c3ccda] p-px">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className={cn('h-3', i < 3 ? 'bg-[#e4e9f1]' : 'bg-white')} />
            ))}
          </div>
          <Lines n={3} className="mt-4" />
        </>
      )}
    </div>
  )
}
