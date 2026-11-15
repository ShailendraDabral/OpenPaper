import { type FormEvent, useState } from 'react'
import { useProject } from '../app/ProjectProvider'
import { isDesktop } from '../backend'
import { Button } from '../components/ui/Button'
import { Dialog, fieldError, fieldInput, fieldLabel } from '../components/ui/Dialog'
import { buttonPrimary } from '../components/ui/styles'
import { cn } from '../lib/cn'
import { starterFiles } from '../templates/starterFiles'
import { templateCategories, templates } from '../templates/templates'

interface Props {
  open: boolean
  onClose: () => void
  /** Template to preselect. */
  templateName?: string
}

/** The same rule the desktop side enforces for a new folder name. */
function nameProblem(name: string): string {
  if (!name) return 'Enter a name for the project folder.'
  if (name.length > 100) return 'Use a shorter name (100 characters at most).'
  // eslint-disable-next-line no-control-regex
  if (/[/\\:*?"<>|\u0000-\u001f]/.test(name) || name === '.' || name === '..' || name.endsWith('.')) {
    return 'Use a name without slashes or the characters : * ? " < > |, and not ending in a dot.'
  }
  return ''
}

export function NewProjectDialog({ open, onClose, templateName }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      description={
        isDesktop
          ? 'A project is an ordinary folder. After this you choose where on your computer to create it.'
          : 'In the browser preview the project is kept in memory only.'
      }
    >
      {/* Keyed so the form starts fresh for each template. */}
      <NewProjectForm key={templateName ?? 'blank'} onClose={onClose} templateName={templateName} />
    </Dialog>
  )
}

function NewProjectForm({ onClose, templateName }: Omit<Props, 'open'>) {
  const { createProject } = useProject()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(templateName ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const folder = name.trim()
    const problem = nameProblem(folder)
    if (problem) return setError(problem)

    setBusy(true)
    setError('')
    try {
      const chosen = templates.find((t) => t.name === template)
      const created = await createProject(folder, starterFiles(chosen, folder))
      if (created) onClose() // otherwise the folder dialog was cancelled: stay here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The project could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className={fieldLabel} htmlFor="np-name">
        Project name
      </label>
      <input
        id="np-name"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        aria-invalid={!!error}
        aria-describedby={error ? 'np-error' : 'np-hint'}
        placeholder="thermal-transport-paper"
        className={fieldInput}
      />
      {error ? (
        <p id="np-error" role="alert" className={fieldError}>
          {error}
        </p>
      ) : (
        <p id="np-hint" className="mt-1.5 text-sm text-muted">
          This becomes the folder name and the title in main.tex.
        </p>
      )}

      <label className={cn(fieldLabel, 'mt-4')} htmlFor="np-template">
        Template
      </label>
      <select id="np-template" value={template} onChange={(e) => setTemplate(e.target.value)} className={fieldInput}>
        <option value="">Blank article</option>
        {templateCategories.map((category) => (
          <optgroup key={category} label={category}>
            {templates
              .filter((t) => t.category === category)
              .map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <button type="submit" disabled={busy} className={cn(buttonPrimary, 'disabled:opacity-60')}>
          {busy ? 'Creating…' : isDesktop ? 'Choose location and create' : 'Create project'}
        </button>
      </div>
    </form>
  )
}
