/** A project's files by path. `null` marks a binary asset (figure) with no editable text. */
export type ProjectFiles = Record<string, string | null>

export interface Issue {
  severity: 'error' | 'warning'
  message: string
  file: string
  line: number
}

/** One typeset block of the preview. `html` fields are already escaped. */
export type Block =
  | { type: 'title'; html: string; authors: string }
  | { type: 'abstract'; html: string }
  | { type: 'heading'; level: 1 | 2; number: string; html: string }
  | { type: 'para'; html: string }
  | { type: 'equation'; html: string; number: number | null }
  | { type: 'figure'; file: string; missing: boolean; caption: string; number: number }
  | { type: 'table'; rows: string[][]; caption: string; number: number }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'bibliography'; entries: { n: number; html: string }[] }

export interface BibEntry {
  key: string
  fields: Record<string, string>
}

export interface CheckResult {
  blocks: Block[]
  issues: Issue[]
  log: string
  errors: number
  warnings: number
}
