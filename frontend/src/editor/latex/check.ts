import { renderDocument } from './render'
import { FIGURE_EXTS, INPUT_RE, allBibEntries, allLabels, reachableFiles, resolveFile, stripComments } from './source'
import type { CheckResult, Issue, ProjectFiles } from './types'

/** Check one .tex file for the mistakes that most often break a compile. */
function lintFile(files: ProjectFiles, path: string, bibKeys: Set<string>, labels: Set<string>): Issue[] {
  const issues: Issue[] = []
  const add = (severity: Issue['severity'], line: number, message: string) => issues.push({ severity, message, file: path, line })
  const lines = stripComments(files[path] as string).split('\n')

  const envStack: { name: string; line: number }[] = []
  const braceStack: number[] = []

  lines.forEach((text, i) => {
    const line = i + 1

    for (const m of text.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
      if (m[1] === 'begin') {
        envStack.push({ name: m[2], line })
      } else {
        // Close back to the nearest matching \begin; anything above it was left open.
        const at = envStack.map((e) => e.name).lastIndexOf(m[2])
        if (at < 0) add('error', line, `\\end{${m[2]}} has no matching \\begin{${m[2]}}.`)
        else for (const open of envStack.splice(at).slice(1)) add('error', open.line, `\\begin{${open.name}} is never closed.`)
      }
    }

    for (let c = 0; c < text.length; c++) {
      if (text[c] === '\\') c++
      else if (text[c] === '{') braceStack.push(line)
      else if (text[c] === '}' && braceStack.pop() === undefined) add('error', line, 'Unexpected }. There is no { for it to close.')
    }

    for (const m of text.matchAll(/\\(?:cite|citep|citet)(?:\[[^\]]*\])?\{([^}]*)\}/g)) {
      for (const key of m[1].split(',').map((k) => k.trim()).filter(Boolean)) {
        if (!bibKeys.has(key)) add('warning', line, `Citation "${key}" is not in the bibliography.`)
      }
    }
    for (const m of text.matchAll(/\\(?:eqref|ref|autoref|cref)\{([^}]*)\}/g)) {
      if (!labels.has(m[1].trim())) add('warning', line, `Reference "${m[1].trim()}" has no matching \\label.`)
    }
    for (const m of text.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
      if (!resolveFile(files, m[1], FIGURE_EXTS)) add('error', line, `Figure file "${m[1]}" was not found in the project.`)
    }
    for (const m of text.matchAll(INPUT_RE)) {
      if (!resolveFile(files, m[1], ['.tex'])) add('error', line, `Input file "${m[1]}" was not found in the project.`)
    }
  })

  for (const open of envStack) add('error', open.line, `\\begin{${open.name}} is never closed.`)
  if (braceStack.length) add('error', braceStack[0], 'This { is never closed.')
  return issues
}

/**
 * Check the project without running LaTeX: look for common mistakes in the
 * sources and build the draft preview. The real compiler will report through
 * the same CheckResult shape, so the Problems and Log panels stay as they are.
 */
export function checkProject(files: ProjectFiles, root: string | null): CheckResult {
  const started = performance.now()
  const log: string[] = ['OpenPaper source checks. This is not a LaTeX run; compiling with your LaTeX installation comes in a later version.', `Root file: ${root ?? 'none'}`]
  const issues: Issue[] = []

  if (root === null || typeof files[root] !== 'string') {
    // A folder without LaTeX sources is not an error; there is simply nothing to check yet.
    log.push('No .tex file found in this project.')
  } else {
    const reachable = reachableFiles(files, root)
    const bib = allBibEntries(files)
    const bibKeys = new Set(bib.map((e) => e.key))
    const labels = new Set(allLabels(files, reachable))

    for (const path of reachable) {
      log.push(`(${path})`)
      issues.push(...lintFile(files, path, bibKeys, labels))
    }
    log.push(`Bibliography: ${bib.length} ${bib.length === 1 ? 'entry' : 'entries'}`)
    if (!/\\begin\{document\}/.test(stripComments(files[root] as string))) {
      issues.push({ severity: 'error', file: root, line: 1, message: 'The root file has no \\begin{document}.' })
    }
  }

  const blocks = root === null ? [] : renderDocument(files, root)
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))

  if (issues.length) log.push('')
  for (const i of issues) log.push(`${i.file}:${i.line}: ${i.severity}: ${i.message}`)
  log.push('', `Draft preview updated (${blocks.length} blocks).`)
  log.push(
    `Finished with ${errors} ${errors === 1 ? 'error' : 'errors'} and ${warnings} ${warnings === 1 ? 'warning' : 'warnings'} in ${Math.max(1, Math.round(performance.now() - started))} ms.`,
  )

  return { blocks, issues, log: log.join('\n'), errors, warnings }
}
