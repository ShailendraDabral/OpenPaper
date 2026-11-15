import { FIGURE_EXTS, allBibEntries, commandArg, expandInputs, readGroup, resolveFile } from './source'
import type { Block, ProjectFiles } from './types'

/**
 * A small LaTeX-to-HTML renderer for the in-browser preview.
 *
 * This is NOT a TeX engine. It understands the common structure of a paper
 * (title, abstract, sections, paragraphs, equations, figures, simple tables,
 * lists, citations, references) and approximates the rest. The real PDF will
 * come from a server-side compile; this keeps the preview panel useful until
 * then and for instant feedback afterwards.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ',
  Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ell: 'ℓ', hbar: 'ℏ',
  partial: '∂', nabla: '∇', infty: '∞', times: '×', cdot: '·', pm: '±', approx: '≈', sim: '∼',
  propto: '∝', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', to: '→', rightarrow: '→',
  sum: '∑', int: '∫', prod: '∏', sqrt: '√', ldots: '…', dots: '…', cdots: '⋯', in: '∈',
}

const UNITS: Record<string, string> = {
  kelvin: 'K', meter: 'm', metre: 'm', second: 's', watt: 'W', nano: 'n', micro: 'µ', milli: 'm',
  kilo: 'k', per: '/', volt: 'V', ampere: 'A', hertz: 'Hz', joule: 'J', degree: '°',
}

/** Maths to HTML. Input must already be HTML-escaped. */
function math(src: string): string {
  let s = src.replace(/\\label\{[^}]*\}/g, '')
  for (let i = 0; i < 3; i++) {
    s = s.replace(
      /\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,
      '<span class="op-frac"><span>$1</span><span>$2</span></span>',
    )
  }
  s = s
    .replace(/\\(?:mathrm|text|mathbf|operatorname)\{([^{}]*)\}/g, '<span class="op-upright">$1</span>')
    .replace(/\\(?:left|right|big|Big)/g, '')
    .replace(/\\[,;:!]|\\quad|\\qquad/g, '&thinsp;')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^(\\[a-zA-Z]+|.)/g, '<sup>$1</sup>')
    .replace(/_(\\[a-zA-Z]+|.)/g, '<sub>$1</sub>')
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => SYMBOLS[name] ?? name)
    .replace(/[{}]/g, '')
    // Digits and operators are upright in maths; skip anything inside a tag or entity.
    .replace(/(<[^>]+>|&[a-z]+;)|(\d+(?:\.\d+)?|[=+≈≤≥×±→])/g, (m, skip: string) =>
      skip ? skip : `<span class="op-upright">${m}</span>`,
    )
  return s
}

interface InlineContext {
  cite: (key: string) => number | null
  ref: (label: string) => string | null
}

/** Running text to HTML. */
function inline(src: string, ctx: InlineContext): string {
  let s = esc(src)
    .replace(/\\label\{[^}]*\}/g, '')
    .replace(/\\(?:cite|citep|citet)(?:\[[^\]]*\])?\{([^}]*)\}/g, (_, keys: string) => {
      const nums = keys.split(',').map((k) => ctx.cite(k.trim()) ?? '<b>?</b>')
      return `[${nums.join(', ')}]`
    })
    .replace(/\\eqref\{([^}]*)\}/g, (_, l: string) => `(${ctx.ref(l.trim()) ?? '<b>??</b>'})`)
    .replace(/\\(?:ref|autoref|cref)\{([^}]*)\}/g, (_, l: string) => ctx.ref(l.trim()) ?? '<b>??</b>')
    .replace(/\\SI\{([^{}]*)\}\{([^{}]*)\}/g, (_, n: string, unit: string) => {
      const u = unit.replace(/\\([a-zA-Z]+)/g, (_m, name: string) => UNITS[name] ?? name).replace(/\s+/g, '')
      return `${n}&nbsp;${u}`
    })
    .replace(/\$([^$]+)\$/g, (_, m: string) => `<i>${math(m)}</i>`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `<i>${math(m)}</i>`)
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>')
      .replace(/\\(?:emph|textit)\{([^{}]*)\}/g, '<i>$1</i>')
      .replace(/\\(?:texttt|url)\{([^{}]*)\}/g, '<code>$1</code>')
  }
  return s
    .replace(/\\\\/g, '<br>')
    .replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g, '')
    .replace(/\\([%&amp;#_$])/g, '$1')
    .replace(/\\&amp;/g, '&amp;')
    .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, '')
    .replace(/[{}]/g, '')
    .replace(/~/g, '&nbsp;')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '“')
    .replace(/''/g, '”')
    .replace(/\s+/g, ' ')
    .trim()
}

const BLOCK_RE =
  /\\begin\{(abstract|equation\*?|align\*?|figure\*?|table\*?|itemize|enumerate)\}([\s\S]*?)\\end\{\1\}|\\(chapter|section|subsection)(\*?)\{([^}]*)\}|\\(maketitle|begin\{frontmatter\}|printbibliography|bibliography\{[^}]*\})/g

/** Commands that describe the document rather than appear in its text. */
const META = /\\(?:title|author|address|affiliation|email|institute|date|bibliographystyle|keywords|thanks)\s*(?:\[[^\]]*\])?\s*\{/g

/** Remove metadata commands, with their (possibly nested) arguments, from running text. */
function stripMeta(src: string): string {
  let out = ''
  let cursor = 0
  META.lastIndex = 0
  for (let m = META.exec(src); m; m = META.exec(src)) {
    const group = readGroup(src, m.index + m[0].length - 1)
    if (!group) continue
    out += src.slice(cursor, m.index)
    cursor = group.end
    META.lastIndex = group.end
  }
  return (out + src.slice(cursor)).replace(/\\begin\{keyword\}[\s\S]*?\\end\{keyword\}/g, '')
}

function parseTabular(body: string, toHtml: (s: string) => string): string[][] {
  const m = /\\begin\{tabular\}\s*\{[^}]*\}([\s\S]*?)\\end\{tabular\}/.exec(body)
  if (!m) return []
  return m[1]
    .replace(/\\(?:hline|toprule|midrule|bottomrule)/g, '')
    .split(/\\\\/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(/(?<!\\)&/).map((cell) => toHtml(cell)))
}

export function renderDocument(files: ProjectFiles, root: string): Block[] {
  const full = expandInputs(files, root)
  const begin = full.indexOf('\\begin{document}')
  const end = full.indexOf('\\end{document}')
  const preamble = begin >= 0 ? full.slice(0, begin) : ''
  const rawBody = begin >= 0 ? full.slice(begin + 16, end >= 0 ? end : undefined) : full
  // Title and authors may be set before \begin{document} or inside it (elsarticle's frontmatter).
  const title = commandArg(preamble, 'title') ?? commandArg(rawBody, 'title')
  const authors = commandArg(preamble, 'author') ?? commandArg(rawBody, 'author') ?? ''
  const body = stripMeta(rawBody)
  const hasChapters = /\\chapter\*?\{/.test(body)
  let titleShown = false

  // Citation numbers follow order of first appearance.
  const citeOrder: string[] = []
  const bib = new Map(allBibEntries(files).map((e) => [e.key, e]))
  for (const m of body.matchAll(/\\(?:cite|citep|citet)(?:\[[^\]]*\])?\{([^}]*)\}/g)) {
    for (const key of m[1].split(',').map((k) => k.trim())) {
      if (bib.has(key) && !citeOrder.includes(key)) citeOrder.push(key)
    }
  }
  const labels = new Map<string, string>()
  const ctx: InlineContext = {
    cite: (key) => (citeOrder.includes(key) ? citeOrder.indexOf(key) + 1 : null),
    ref: (label) => labels.get(label) ?? null,
  }
  const toHtml = (s: string) => inline(s, ctx)

  // Pass 1 walks the body, numbers things and records labels.
  // Blocks are built lazily so forward references resolve in pass 2.
  const pending: Array<() => Block | null> = []
  const counters = { chapter: 0, section: 0, subsection: 0, equation: 0, figure: 0, table: 0 }
  let lastNumber = ''

  const addText = (text: string) => {
    const lead = /^\s*\\label\{([^}]+)\}/.exec(text)
    if (lead && lastNumber) labels.set(lead[1], lastNumber)
    for (const para of text.split(/\n\s*\n/)) {
      if (para.trim()) {
        pending.push(() => {
          const html = toHtml(para)
          return html ? { type: 'para', html } : null
        })
      }
    }
  }
  const recordLabels = (src: string, number: string) => {
    for (const m of src.matchAll(/\\label\{([^}]+)\}/g)) labels.set(m[1], number)
  }

  let cursor = 0
  for (const m of body.matchAll(BLOCK_RE)) {
    addText(body.slice(cursor, m.index))
    cursor = (m.index ?? 0) + m[0].length
    const [, env, envBody, sectionKind, starred, sectionTitle, command] = m

    if (command === 'maketitle' || command === 'begin{frontmatter}') {
      if (title && !titleShown) {
        titleShown = true
        pending.push(() => ({
          type: 'title',
          html: toHtml(title),
          authors: toHtml(authors.replace(/\s*\\and\s*/g, ', ')),
        }))
      }
    } else if (command) {
      pending.push(() => ({
        type: 'bibliography',
        entries: citeOrder.map((key, i) => {
          const f = bib.get(key)!.fields
          const parts = [
            f.author && `${esc(f.author).replace(/ and /g, ', ').replace(/\.$/, '')}.`,
            f.title && `${esc(f.title)}.`,
            f.journal && `<i>${esc(f.journal)}</i>${f.volume ? ` <b>${esc(f.volume)}</b>` : ''}${f.pages ? `, ${esc(f.pages).replace(/--/g, '–')}` : ''}`,
            f.year && `(${esc(f.year)}).`,
          ]
          return { n: i + 1, html: parts.filter(Boolean).join(' ') }
        }),
      }))
    } else if (sectionKind) {
      // With chapters, sections are numbered inside them: "2.1".
      const prefix = hasChapters && counters.chapter > 0 ? `${counters.chapter}.` : ''
      if (starred) {
        lastNumber = ''
      } else if (sectionKind === 'chapter') {
        counters.chapter++
        counters.section = 0
        counters.subsection = 0
        lastNumber = `${counters.chapter}`
      } else if (sectionKind === 'section') {
        counters.section++
        counters.subsection = 0
        lastNumber = `${prefix}${counters.section}`
      } else {
        counters.subsection++
        lastNumber = `${prefix}${counters.section}.${counters.subsection}`
      }
      const number = lastNumber
      const level = sectionKind === 'chapter' || (sectionKind === 'section' && !hasChapters) ? 1 : 2
      pending.push(() => ({ type: 'heading', level, number, html: toHtml(sectionTitle) }))
      continue
    } else if (env === 'abstract') {
      pending.push(() => ({ type: 'abstract', html: toHtml(envBody) }))
    } else if (env.startsWith('equation') || env.startsWith('align')) {
      const number = env.endsWith('*') ? null : ++counters.equation
      if (number) recordLabels(envBody, `${number}`)
      pending.push(() => ({
        type: 'equation',
        number,
        html: math(esc(envBody).replace(/&amp;/g, '').replace(/\\\\/g, '<br>')),
      }))
    } else if (env.startsWith('figure')) {
      const number = ++counters.figure
      recordLabels(envBody, `${number}`)
      const file = commandArg(envBody, 'includegraphics') ?? ''
      pending.push(() => ({
        type: 'figure',
        number,
        file,
        missing: !resolveFile(files, file, FIGURE_EXTS),
        caption: toHtml(commandArg(envBody, 'caption') ?? ''),
      }))
    } else if (env.startsWith('table')) {
      const number = ++counters.table
      recordLabels(envBody, `${number}`)
      pending.push(() => ({
        type: 'table',
        number,
        rows: parseTabular(envBody, toHtml),
        caption: toHtml(commandArg(envBody, 'caption') ?? ''),
      }))
    } else {
      pending.push(() => ({
        type: 'list',
        ordered: env === 'enumerate',
        items: envBody.split(/\\item\b/).slice(1).map(toHtml),
      }))
    }
    lastNumber = ''
  }
  addText(body.slice(cursor))

  return pending.map((build) => build()).filter((b): b is Block => b !== null)
}
