import type { Issue } from './types'

/**
 * Parses raw terminal compiler logs from Tectonic, pdfLaTeX, XeLaTeX, etc.
 * into structured Overleaf-style errors and warnings with clickable file and line numbers.
 */
export function parseLatexLog(log: string, defaultFile = 'main.tex'): Issue[] {
  if (!log) return []

  const issues: Issue[] = []
  const lines = log.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 1. Tectonic error format:
    // error: main.tex:18: Package fontspec Error: ...
    const tectonicMatch = /^error:\s*([^:]+):(\d+):\s*(.+)$/i.exec(line)
    if (tectonicMatch) {
      issues.push({
        file: cleanPath(tectonicMatch[1]),
        line: parseInt(tectonicMatch[2], 10),
        message: tectonicMatch[3].trim(),
        severity: 'error',
      })
      continue
    }

    // 2. Standard file-line-error format:
    // ./main.tex:42: Undefined control sequence
    // main.tex:15: LaTeX Error: ...
    const fileLineMatch = /^(?:\.\/)?([^:\s]+\.tex):(\d+):\s*(.+)$/i.exec(line)
    if (fileLineMatch) {
      issues.push({
        file: cleanPath(fileLineMatch[1]),
        line: parseInt(fileLineMatch[2], 10),
        message: fileLineMatch[3].trim(),
        severity: 'error',
      })
      continue
    }

    // 3. LaTeX Warning: Reference '...' on page X undefined on input line 78.
    const refWarnMatch = /LaTeX Warning:\s*Reference\s*`([^']+)'(?:\s*on page \d+)?\s*undefined on input line (\d+)/i.exec(line)
    if (refWarnMatch) {
      issues.push({
        file: defaultFile,
        line: parseInt(refWarnMatch[2], 10),
        message: `Undefined reference '${refWarnMatch[1]}'`,
        severity: 'warning',
      })
      continue
    }

    // 4. LaTeX Warning: Citation '...' on page X undefined on input line 35.
    const citeWarnMatch = /LaTeX Warning:\s*Citation\s*`([^']+)'(?:\s*on page \d+)?\s*undefined on input line (\d+)/i.exec(line)
    if (citeWarnMatch) {
      issues.push({
        file: defaultFile,
        line: parseInt(citeWarnMatch[2], 10),
        message: `Undefined citation '${citeWarnMatch[1]}'`,
        severity: 'warning',
      })
      continue
    }

    // 5. General LaTeX Warnings with line numbers:
    // LaTeX Warning: ... on input line 50.
    // Package hyperref Warning: ... on input line 50.
    const genWarnMatch = /(?:LaTeX|Package\s+\w+)\s+Warning:\s*(.+?)(?:\s+on input line (\d+))\.?$/i.exec(line)
    if (genWarnMatch) {
      issues.push({
        file: defaultFile,
        line: genWarnMatch[2] ? parseInt(genWarnMatch[2], 10) : 1,
        message: genWarnMatch[1].trim(),
        severity: 'warning',
      })
      continue
    }

    // 6. Classic TeX exclamation mark error:
    // ! Undefined control sequence.
    // followed by l.42 ...
    if (line.startsWith('! ') && !line.includes('==> Fatal error occurred')) {
      const msg = line.slice(2).trim()
      let lineNum = 1
      let file = defaultFile

      // Check next few lines for `l.<number>` or filename
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const next = lines[j].trim()
        const lMatch = /^l\.(\d+)/.exec(next)
        if (lMatch) {
          lineNum = parseInt(lMatch[1], 10)
          break
        }
      }

      issues.push({
        file,
        line: lineNum,
        message: msg,
        severity: 'error',
      })
    }
  }

  // Deduplicate issues by file:line:message
  const seen = new Set<string>()
  return issues.filter((iss) => {
    const key = `${iss.file}:${iss.line}:${iss.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cleanPath(path: string): string {
  return path.replace(/^(\.\/|\.\\)/, '').replace(/\\/g, '/')
}
