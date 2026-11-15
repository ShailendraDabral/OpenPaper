import type { ReactNode } from 'react'
import { editorFontSizes, usePreferences } from '../../app/PreferencesProvider'
import { useTheme } from '../../app/ThemeProvider'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageContainer, PageHeader } from '../../components/ui/PageHeader'
import { selectInput } from '../../components/ui/styles'

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { preferences, setPreference } = usePreferences()

  return (
    <PageContainer narrow>
      <PageHeader title="Settings" description="Changes apply immediately and are remembered on this computer." />

      <Section title="Appearance">
        <Row label="Theme" hint="Applies to the whole app.">
          <FilterChips
            label="Theme"
            options={['Light', 'Dark'] as const}
            value={theme === 'dark' ? 'Dark' : 'Light'}
            onChange={(v) => setTheme(v === 'Dark' ? 'dark' : 'light')}
            size="sm"
          />
        </Row>
      </Section>

      <Section title="Editor">
        <Row label="Font size" hint="Text size in the code editor." htmlFor="pref-font">
          <select
            id="pref-font"
            value={preferences.editorFontSize}
            onChange={(e) => setPreference('editorFontSize', Number(e.target.value))}
            className={selectInput}
          >
            {editorFontSizes.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>
        </Row>
        <p
          className="mt-4 rounded-md border border-line bg-[var(--code-bg)] px-4 py-3 font-mono text-[var(--code-text)]"
          style={{ fontSize: preferences.editorFontSize }}
        >
          <span className="text-[var(--tok-command)]">\section</span>
          {'{Introduction}'} <span className="text-[var(--tok-comment)] italic">% sample</span>
        </p>
      </Section>

      <Section title="LaTeX compiler">
        <p className="text-sm leading-relaxed text-body">
          Not available in this version. Detecting your LaTeX installation and choosing between pdfLaTeX, XeLaTeX and
          LuaLaTeX arrive with the compiler.
        </p>
      </Section>
    </PageContainer>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, htmlFor, children }: { label: string; hint: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-ink">{label}</p>
        )}
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      {children}
    </div>
  )
}
