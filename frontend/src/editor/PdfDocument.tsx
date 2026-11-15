import { ImageIcon, ImageOff } from 'lucide-react'
import type { Block } from './latex/types'

const html = (s: string) => ({ __html: s })

/**
 * The typeset page. Sizes are in em and the root font-size is tied to the
 * sheet's width (container query units), so the page scales like a PDF.
 */
export function PdfDocument({ blocks }: { blocks: Block[] }) {
  return (
    <div className="[container-type:inline-size] bg-white text-[#1a2233] shadow-page ring-1 ring-black/5">
      <article
        aria-label="Document preview"
        className="min-h-[141cqw] px-[12cqw] pt-[11cqw] pb-[10cqw] font-serif text-[max(1.72cqw,5px)] leading-[1.5]"
      >
        {blocks.length === 0 && <p className="text-center text-[#6b7688]">Nothing to show yet. Write something in main.tex and compile.</p>}
        {blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </article>
    </div>
  )
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case 'title':
      return (
        <header className="mb-[2em] text-center">
          <h1 className="text-[1.75em] leading-[1.2] font-medium" dangerouslySetInnerHTML={html(b.html)} />
          {b.authors && <p className="mt-[0.9em] text-[1.1em]" dangerouslySetInnerHTML={html(b.authors)} />}
        </header>
      )
    case 'abstract':
      return (
        <section className="mx-[2.5em] mb-[1.8em] text-[0.92em]">
          <p className="mb-[0.4em] text-center font-semibold">Abstract</p>
          <p className="text-justify hyphens-auto" dangerouslySetInnerHTML={html(b.html)} />
        </section>
      )
    case 'heading':
      return b.level === 1 ? (
        <h2 className="mt-[1.5em] mb-[0.6em] text-[1.3em] font-semibold">
          <span className="mr-[0.8em]">{b.number}</span>
          <span dangerouslySetInnerHTML={html(b.html)} />
        </h2>
      ) : (
        <h3 className="mt-[1.2em] mb-[0.5em] text-[1.1em] font-semibold">
          <span className="mr-[0.8em]">{b.number}</span>
          <span dangerouslySetInnerHTML={html(b.html)} />
        </h3>
      )
    case 'para':
      return <p className="mb-[0.7em] text-justify hyphens-auto" dangerouslySetInnerHTML={html(b.html)} />
    case 'equation':
      return (
        <div className="relative my-[1em] flex items-center justify-center">
          <span className="text-[1.1em] italic" dangerouslySetInnerHTML={html(b.html)} />
          {b.number !== null && <span className="absolute right-0">({b.number})</span>}
        </div>
      )
    case 'figure':
      return (
        <figure className="my-[1.5em]">
          <div
            className={`mx-auto flex aspect-[16/9] w-4/5 flex-col items-center justify-center gap-[0.6em] rounded-[0.3em] border font-sans text-[0.85em] ${
              b.missing ? 'border-dashed border-[#d14343] text-[#b3261e]' : 'border-[#d5dbe5] bg-[#f4f6f9] text-[#6b7688]'
            }`}
          >
            {b.missing ? <ImageOff className="h-[2em] w-[2em]" strokeWidth={1.5} /> : <ImageIcon className="h-[2em] w-[2em]" strokeWidth={1.5} />}
            <span className="font-mono">{b.file || 'no file given'}</span>
            {b.missing && <span>File not found</span>}
          </div>
          <figcaption className="mx-[2em] mt-[0.8em] text-center text-[0.92em]">
            Figure {b.number}: <span dangerouslySetInnerHTML={html(b.caption)} />
          </figcaption>
        </figure>
      )
    case 'table':
      return (
        <figure className="my-[1.5em]">
          <figcaption className="mx-[2em] mb-[0.6em] text-center text-[0.92em]">
            Table {b.number}: <span dangerouslySetInnerHTML={html(b.caption)} />
          </figcaption>
          {b.rows.length > 0 && (
            <table className="mx-auto border-y-[0.12em] border-[#1a2233]">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? 'border-b-[0.07em] border-[#1a2233]' : undefined}>
                    {row.map((cell, c) => (
                      <td key={c} className="px-[1em] py-[0.25em]" dangerouslySetInnerHTML={html(cell)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </figure>
      )
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return (
        <Tag className={`mb-[0.7em] pl-[2em] ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
          {b.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={html(item)} />
          ))}
        </Tag>
      )
    }
    case 'bibliography':
      return (
        <section>
          <h2 className="mt-[1.5em] mb-[0.6em] text-[1.3em] font-semibold">References</h2>
          <ol className="space-y-[0.4em] text-[0.95em]">
            {b.entries.map((e) => (
              <li key={e.n} className="flex gap-[0.7em]">
                <span className="shrink-0">[{e.n}]</span>
                <span dangerouslySetInnerHTML={html(e.html)} />
              </li>
            ))}
          </ol>
        </section>
      )
  }
}
