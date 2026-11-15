import type { BibEntry, ProjectFiles } from './types'

/** Remove % comments but keep line breaks, so line numbers stay valid. */
export function stripComments(src: string): string {
  return src.replace(/(^|[^\\])%.*$/gm, '$1')
}

/** Find a project file by name, trying the given extensions. */
export function resolveFile(files: ProjectFiles, name: string, exts: string[] = []): string | null {
  const clean = name.trim().replace(/^\.\//, '')
  for (const candidate of [clean, ...exts.map((e) => clean + e)]) {
    if (candidate in files) return candidate
  }
  return null
}

export const INPUT_RE = /\\(?:input|include)\{([^}]+)\}/g
export const FIGURE_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.eps']

/** The root file plus every file it pulls in through \input, in order. */
export function reachableFiles(files: ProjectFiles, root: string): string[] {
  const seen: string[] = []
  const visit = (path: string) => {
    if (seen.includes(path)) return
    seen.push(path)
    const src = files[path]
    if (typeof src !== 'string') return
    for (const m of stripComments(src).matchAll(INPUT_RE)) {
      const target = resolveFile(files, m[1], ['.tex'])
      if (target) visit(target)
    }
  }
  visit(root)
  return seen
}

/** Inline every \input so the document can be read as one string. */
export function expandInputs(files: ProjectFiles, path: string, depth = 0): string {
  const src = files[path]
  if (typeof src !== 'string' || depth > 8) return ''
  return stripComments(src).replace(INPUT_RE, (_, name: string) => {
    const target = resolveFile(files, name, ['.tex'])
    return target ? expandInputs(files, target, depth + 1) : ''
  })
}

/** Read a balanced {...} group starting at `open` (which must be a "{"). */
export function readGroup(s: string, open: number): { text: string; end: number } | null {
  if (s[open] !== '{') return null
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '\\') i++
    else if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return { text: s.slice(open + 1, i), end: i + 1 }
  }
  return null
}

/** First argument of \name[...]{...} in `s`, or null. */
export function commandArg(s: string, name: string): string | null {
  const m = new RegExp(`\\\\${name}\\s*(?:\\[[^\\]]*\\])?\\s*\\{`).exec(s)
  if (!m) return null
  return readGroup(s, m.index + m[0].length - 1)?.text ?? null
}

export function parseBib(src: string): BibEntry[] {
  const entries: BibEntry[] = []
  const starts = [...src.matchAll(/@(\w+)\s*\{\s*([^,\s]+)\s*,/g)]
  starts.forEach((m, i) => {
    const body = src.slice((m.index ?? 0) + m[0].length, starts[i + 1]?.index ?? src.length)
    const fields: Record<string, string> = {}
    for (const f of body.matchAll(/(\w+)\s*=\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      fields[f[1].toLowerCase()] = f[2].replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
    }
    entries.push({ key: m[2], fields })
  })
  return entries
}

export function allBibEntries(files: ProjectFiles): BibEntry[] {
  return Object.entries(files)
    .filter(([path, src]) => path.endsWith('.bib') && typeof src === 'string')
    .flatMap(([, src]) => parseBib(src as string))
}

export function allLabels(files: ProjectFiles, paths: string[]): string[] {
  const labels = new Set<string>()
  for (const p of paths) {
    const src = files[p]
    if (typeof src === 'string') for (const m of stripComments(src).matchAll(/\\label\{([^}]+)\}/g)) labels.add(m[1])
  }
  return [...labels]
}
