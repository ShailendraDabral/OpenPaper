import { stripComments } from './source'

export interface WordCountStats {
  totalWords: number
  textWords: number
  headerWords: number
  captionWords: number
  mathDisplays: number
  figureCount: number
  tableCount: number
}

function countWords(str: string): number {
  const words = str.trim().split(/\s+/)
  return words.length === 1 && words[0] === '' ? 0 : words.length
}

/**
 * Calculates academic word count breakdown matching texcount rules:
 * - Excludes preamble (before \begin{document})
 * - Excludes LaTeX comments (%)
 * - Excludes inline and display math
 * - Separates text, header, and caption words
 */
export function computeLatexWordCount(rawLatex: string): WordCountStats {
  if (!rawLatex) {
    return {
      totalWords: 0,
      textWords: 0,
      headerWords: 0,
      captionWords: 0,
      mathDisplays: 0,
      figureCount: 0,
      tableCount: 0,
    }
  }

  // 1. Remove comments
  let src = stripComments(rawLatex)

  // 2. Extract content inside \begin{document}...\end{document} if present
  const docStart = src.indexOf('\\begin{document}')
  if (docStart !== -1) {
    src = src.slice(docStart + '\\begin{document}'.length)
  }
  const docEnd = src.indexOf('\\end{document}')
  if (docEnd !== -1) {
    src = src.slice(0, docEnd)
  }

  // 3. Count figures and tables
  const figureCount = (src.match(/\\begin\{(?:figure|figure\*)\}/g) || []).length
  const tableCount = (src.match(/\\begin\{(?:table|table\*)\}/g) || []).length

  // 4. Count and extract math displays
  const mathDisplays = (src.match(/\\begin\{(?:equation|align|gather|multline|displaymath)\*?\}|\$\$[\s\S]*?\$\$/g) || []).length
  src = src.replace(/\\begin\{(?:equation|align|gather|multline|displaymath)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline|displaymath)\*?\}/g, ' ')
  src = src.replace(/\$\$[\s\S]*?\$\$/g, ' ')
  src = src.replace(/\\\[[\s\S]*?\\\]/g, ' ')

  // 5. Extract header words
  let headerWords = 0
  const headerRegex = /\\(?:part|chapter|section|subsection|subsubsection|paragraph)\*?\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = headerRegex.exec(src)) !== null) {
    headerWords += countWords(match[1])
  }
  src = src.replace(headerRegex, ' ')

  // 6. Extract caption words
  let captionWords = 0
  const captionRegex = /\\caption\*?\{([^}]+)\}/g
  while ((match = captionRegex.exec(src)) !== null) {
    captionWords += countWords(match[1])
  }
  src = src.replace(captionRegex, ' ')

  // 7. Remove inline math $...$
  src = src.replace(/\$[^$]*\$/g, ' ')

  // 8. Remove citations and references
  src = src.replace(/\\(?:cite[a-z]*|ref|eqref|label|pageref|autoref|cref|Cref)(?:\[[^\]]*\])?\{[^}]*\}/g, ' ')

  // 9. Remove standard formatting/styling tags, keeping text inside
  src = src.replace(/\\(?:textbf|textit|emph|texttt|textsc|textsl|text|underline)\{([^}]+)\}/g, '$1')

  // 10. Remove remaining commands: \command, \command[opt]{arg}
  src = src.replace(/\\[a-zA-Z]+(?:\*|\b)(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ')
  src = src.replace(/[{}]/g, ' ')

  const textWords = countWords(src)
  const totalWords = textWords + headerWords + captionWords

  return {
    totalWords,
    textWords,
    headerWords,
    captionWords,
    mathDisplays,
    figureCount,
    tableCount,
  }
}
