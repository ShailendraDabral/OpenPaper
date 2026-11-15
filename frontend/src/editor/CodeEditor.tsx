import { foldAll, unfoldAll } from '@codemirror/language'
import { openSearchPanel, search } from '@codemirror/search'
import { Annotation, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { type CompletionData, languageFor } from './latexEditor'

/** Marks a change that came from the disk, not from typing, so it is not saved back. */
const fromDisk = Annotation.define<boolean>()

export interface CodeEditorHandle {
  /** Replace a file's text with a newer version read from disk. */
  replaceContent: (path: string, content: string) => void
  openSearch: () => void
  foldAll: () => void
  unfoldAll: () => void
  focus: () => void
}

export interface CursorPosition {
  line: number
  column: number
}

interface Props {
  ref?: Ref<CodeEditorHandle>
  /** File being edited. Each file keeps its own undo history, folds and cursor. */
  path: string
  /** Current text of `path`; read when the file is first opened. */
  value: string
  onChange: (path: string, value: string) => void
  onCursor: (position: CursorPosition) => void
  /** Ctrl/Cmd+S: save now instead of waiting for autosave. */
  onSave: () => void
  getCompletionData: () => CompletionData
  /** Jump to a line. Change `nonce` to repeat a jump to the same line. */
  reveal?: { path: string; line: number; nonce: number }
}

/**
 * CodeMirror 6 wrapper: line numbers, folding, search (Ctrl/Cmd+F), save (Ctrl/Cmd+S),
 * bracket matching, history and LaTeX-aware autocomplete.
 */
export function CodeEditor({ ref, path, value, onChange, onCursor, onSave, getCompletionData, reveal }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const states = useRef(new Map<string, EditorState>())
  const current = useRef(path)

  // Latest callbacks, so the editor never needs rebuilding when they change.
  const latest = useRef({ onChange, onCursor, onSave, getCompletionData })
  latest.current = { onChange, onCursor, onSave, getCompletionData }

  const createState = (filePath: string, doc: string) =>
    EditorState.create({
      doc,
      extensions: [
        basicSetup,
        search({ top: true }),
        EditorView.lineWrapping,
        languageFor(filePath, () => latest.current.getCompletionData()),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                latest.current.onSave()
                return true
              },
            },
          ]),
        ),
        EditorView.updateListener.of((update) => {
          const typed = update.docChanged && !update.transactions.some((tr) => tr.annotation(fromDisk))
          if (typed) latest.current.onChange(filePath, update.state.doc.toString())
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            latest.current.onCursor({ line: line.number, column: head - line.from + 1 })
          }
        }),
      ],
    })

  // Mount once.
  useEffect(() => {
    const v = new EditorView({ parent: host.current!, state: createState(path, value) })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switch files: park the old state, restore or create the new one.
  useEffect(() => {
    const v = view.current
    if (!v || current.current === path) return
    states.current.set(current.current, v.state)
    current.current = path
    v.setState(states.current.get(path) ?? createState(path, value))
    latest.current.onCursor({ line: 1, column: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // Jump to a line (from the problems panel).
  useEffect(() => {
    const v = view.current
    if (!v || !reveal || reveal.path !== current.current) return
    const line = v.state.doc.line(Math.min(Math.max(reveal.line, 1), v.state.doc.lines))
    v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
    v.focus()
  }, [reveal])

  useImperativeHandle(ref, () => ({
    replaceContent: (filePath, content) => {
      const v = view.current
      if (v && filePath === current.current) {
        v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: content }, annotations: fromDisk.of(true) })
      } else {
        states.current.delete(filePath) // rebuilt from the new text when the file is next shown
      }
    },
    openSearch: () => view.current && openSearchPanel(view.current),
    foldAll: () => view.current && foldAll(view.current),
    unfoldAll: () => view.current && unfoldAll(view.current),
    focus: () => view.current?.focus(),
  }))

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />
}
