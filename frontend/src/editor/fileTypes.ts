/** Which files the editor opens as text, decided by name. */

const TEXT_EXTENSIONS = new Set([
  'tex', 'bib', 'sty', 'cls', 'bst', 'bbx', 'cbx', 'lbx', 'def', 'cfg', 'clo', 'dtx', 'ins', 'tikz', 'ltx',
  'txt', 'md', 'csv', 'tsv', 'json', 'yml', 'yaml', 'toml', 'xml', 'gitignore', 'latexmkrc', 'gitattributes',
])
const TEXT_NAMES = /^(readme|license|licence|makefile|latexmkrc)$/i

export function isTextPath(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot < 0) return TEXT_NAMES.test(name)
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

/** The file LaTeX starts from: main.tex, else the first .tex with a \documentclass, else any .tex. */
export function findRootFile(files: Record<string, string | null>): string | null {
  const tex = Object.keys(files)
    .filter((p) => p.endsWith('.tex') && typeof files[p] === 'string')
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  if (tex.includes('main.tex')) return 'main.tex'
  return tex.find((p) => /\\documentclass/.test(files[p] as string)) ?? tex[0] ?? null
}
