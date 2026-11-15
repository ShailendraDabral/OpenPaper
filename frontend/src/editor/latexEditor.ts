import { type Completion, type CompletionContext, type CompletionResult, snippet as applySnippet, snippetCompletion, startCompletion } from '@codemirror/autocomplete'
import { HighlightStyle, StreamLanguage, foldService, syntaxHighlighting } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/* ------------------------------ Autocomplete ------------------------------ */

/** Project facts the completions draw on. Read lazily so they are always current. */
export interface CompletionData {
  citations: { key: string; title: string }[]
  labels: string[]
  texFiles: string[]
  figureFiles: string[]
}

const ENVIRONMENTS = ['abstract', 'align', 'center', 'document', 'enumerate', 'equation', 'figure', 'itemize', 'table', 'tabular', 'theorem', 'proof']

const snippet = (template: string, label: string, detail: string) => snippetCompletion(template, { label, detail, type: 'function' })

/** A command whose argument has its own suggestions (keys, labels, files): insert it, then open that list. */
const chained = (template: string, label: string, detail: string): Completion => ({
  label,
  detail,
  type: 'function',
  apply: (view, completion, from, to) => {
    applySnippet(template)(view, completion, from, to)
    startCompletion(view)
  },
})

const COMMANDS: Completion[] = [
  snippet('\\begin{${env}}\n\t${}\n\\end{${env}}', '\\begin', 'environment'),
  snippet('\\section{${title}}', '\\section', 'heading'),
  snippet('\\subsection{${title}}', '\\subsection', 'heading'),
  chained('\\cite{${}}', '\\cite', 'citation'),
  chained('\\ref{${}}', '\\ref', 'cross-reference'),
  chained('\\eqref{${}}', '\\eqref', 'equation reference'),
  snippet('\\label{${name}}', '\\label', 'label'),
  snippet('\\frac{${num}}{${den}}', '\\frac', 'fraction'),
  snippet('\\includegraphics[width=${0.8}\\linewidth]{${file}}', '\\includegraphics', 'figure file'),
  snippet('\\caption{${text}}', '\\caption', 'caption'),
  chained('\\input{${}}', '\\input', 'include a file'),
  snippet('\\usepackage{${package}}', '\\usepackage', 'package'),
  snippet('\\textbf{${text}}', '\\textbf', 'bold'),
  snippet('\\emph{${text}}', '\\emph', 'emphasis'),
  snippet('\\texttt{${text}}', '\\texttt', 'monospace'),
  snippet('\\begin{equation}\n\t${}\n\\end{equation}', '\\begin{equation}', 'numbered equation'),
  snippet('\\begin{figure}[t]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${file}}\n\t\\caption{${caption}}\n\t\\label{fig:${name}}\n\\end{figure}', '\\begin{figure}', 'figure with caption'),
  snippet('\\begin{itemize}\n\t\\item ${}\n\\end{itemize}', '\\begin{itemize}', 'bullet list'),
  ...['item', 'centering', 'maketitle', 'printbibliography', 'tableofcontents', 'newpage', 'alpha', 'beta', 'gamma', 'delta', 'theta', 'kappa', 'lambda', 'mu', 'pi', 'sigma', 'omega', 'ell', 'partial', 'nabla', 'infty', 'times', 'approx', 'leq', 'geq', 'sum', 'int'].map(
    (name): Completion => ({ label: `\\${name}`, type: 'keyword' }),
  ),
]

function list(context: CompletionContext, typed: string, options: Completion[]): CompletionResult {
  return { from: context.pos - typed.length, options, validFor: /^[\w:./-]*$/ }
}

export function latexCompletionSource(getData: () => CompletionData) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos)
    const before = line.text.slice(0, context.pos - line.from)
    const data = getData()
    let m: RegExpExecArray | null

    if ((m = /\\(?:cite|citep|citet)(?:\[[^\]]*\])?\{(?:[^}]*,\s*)?([^},]*)$/.exec(before))) {
      return list(context, m[1], data.citations.map((c) => ({ label: c.key, detail: c.title, type: 'constant' })))
    }
    if ((m = /\\(?:eqref|ref|autoref|cref)\{([^}]*)$/.exec(before))) {
      return list(context, m[1], data.labels.map((label) => ({ label, type: 'constant' })))
    }
    if ((m = /\\(?:begin|end)\{([^}]*)$/.exec(before))) {
      return list(context, m[1], ENVIRONMENTS.map((label) => ({ label, type: 'type' })))
    }
    if ((m = /\\(?:input|include)\{([^}]*)$/.exec(before))) {
      return list(context, m[1], data.texFiles.map((f) => ({ label: f.replace(/\.tex$/, ''), type: 'text' })))
    }
    if ((m = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)$/.exec(before))) {
      return list(context, m[1], data.figureFiles.map((f) => ({ label: f.replace(/\.\w+$/, ''), detail: f, type: 'text' })))
    }
    if ((m = /\\[a-zA-Z]*$/.exec(before))) {
      return { from: context.pos - m[0].length, options: COMMANDS, validFor: /^\\[a-zA-Z{}]*$/ }
    }
    return null
  }
}

/* ------------------------------- Folding ------------------------------- */

const SECTION_LEVEL: Record<string, number> = { section: 1, subsection: 2, subsubsection: 3 }

/** Fold \begin...\end blocks, sections (to the next heading) and BibTeX entries. */
const latexFolding = foldService.of((state, lineStart) => {
  const first = state.doc.lineAt(lineStart)
  const total = state.doc.lines
  const foldTo = (lastLine: number) =>
    lastLine > first.number ? { from: first.to, to: state.doc.line(lastLine).to } : null

  const env = /^\s*\\begin\{([^}]+)\}/.exec(first.text)
  if (env) {
    const open = `\\begin{${env[1]}}`
    const close = `\\end{${env[1]}}`
    let depth = first.text.split(open).length - 1 - (first.text.split(close).length - 1)
    if (depth <= 0) return null
    for (let n = first.number + 1; n <= total; n++) {
      const text = state.doc.line(n).text
      depth += text.split(open).length - 1 - (text.split(close).length - 1)
      if (depth <= 0) return foldTo(n - 1)
    }
    return null
  }

  const section = /^\s*\\(section|subsection|subsubsection)\*?\{/.exec(first.text)
  if (section) {
    const level = SECTION_LEVEL[section[1]]
    let last = total
    for (let n = first.number + 1; n <= total; n++) {
      const next = /^\s*\\(section|subsection|subsubsection)\*?\{|^\s*\\end\{document\}/.exec(state.doc.line(n).text)
      if (next && (!next[1] || SECTION_LEVEL[next[1]] <= level)) {
        last = n - 1
        break
      }
    }
    while (last > first.number && !state.doc.line(last).text.trim()) last--
    return foldTo(last)
  }

  if (/^@\w+\s*\{/.test(first.text)) {
    for (let n = first.number + 1; n <= total; n++) {
      if (/^\}/.test(state.doc.line(n).text)) return foldTo(n - 1)
    }
  }
  return null
})

/* ------------------------- Highlighting and theme ------------------------- */

const highlight = HighlightStyle.define([
  { tag: t.tagName, color: 'var(--tok-command)' },
  { tag: t.keyword, color: 'var(--tok-keyword)', fontWeight: '600' },
  { tag: [t.atom, t.standard(t.variableName)], color: 'var(--tok-atom)' },
  { tag: t.comment, color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: [t.string, t.number], color: 'var(--tok-math)' },
  { tag: t.bracket, color: 'var(--tok-bracket)' },
  { tag: t.invalid, color: '#d14343' },
])

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--code-text)', backgroundColor: 'var(--code-bg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: 'var(--code-font-size, 13px)', lineHeight: '1.65' },
  '.cm-content': { padding: '10px 0', caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--code-gutter)', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 14px', minWidth: '28px' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 6px 0 2px', cursor: 'pointer' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)', color: 'var(--ink)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--code-selection)' },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, #e0a400 35%, transparent)', outline: '1px solid #e0a40080' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, #e0a400 65%, transparent)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--line)',
    color: 'var(--accent)',
    padding: '0 6px',
    margin: '0 4px',
    borderRadius: '4px',
  },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--body)', fontFamily: 'var(--font-sans)' },
  '.cm-panels-top': { borderBottom: '1px solid var(--line)' },
  '.cm-panel.cm-search': { padding: '8px 12px', fontSize: '13px' },
  '.cm-panel.cm-search label': { fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  '.cm-textfield': {
    backgroundColor: 'var(--canvas)',
    color: 'var(--ink)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '13px',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--raised)',
    color: 'var(--ink)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '12px',
  },
  '.cm-panel.cm-search [name=close]': { color: 'var(--muted)', fontSize: '18px', padding: '0 6px' },
  '.cm-tooltip': {
    backgroundColor: 'var(--raised)',
    color: 'var(--ink)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-page)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', maxHeight: '16em' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent)', color: '#fff' },
  '.dark & .cm-tooltip-autocomplete > ul > li[aria-selected]': { color: '#0b2545' },
  '.cm-completionDetail': { fontFamily: 'var(--font-sans)', fontStyle: 'normal', opacity: '0.7', marginLeft: '1em' },
  '.cm-completionIcon': { display: 'none' },
})

const stexLanguage = StreamLanguage.define(stex)

/** Editor extensions for a file, chosen by its extension. */
export function languageFor(path: string, getData: () => CompletionData): Extension[] {
  const shared = [theme, syntaxHighlighting(highlight), latexFolding]
  if (!path.endsWith('.tex')) return shared
  return [...shared, stexLanguage, stexLanguage.data.of({ autocomplete: latexCompletionSource(getData) })]
}
