import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Preferences for this installation, kept in the web view's local storage. */
export interface Preferences {
  editorFontSize: number
}

export const editorFontSizes = [12, 13, 14, 15, 16]

const defaults: Preferences = { editorFontSize: 13 }
const STORAGE_KEY = 'openpaper-preferences'

function load(): Preferences {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

interface Value {
  preferences: Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

const PreferencesContext = createContext<Value | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(load)

  useEffect(() => {
    // The code editor reads its font size from this variable.
    document.documentElement.style.setProperty('--code-font-size', `${preferences.editorFontSize}px`)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      /* storage unavailable: preferences last for this visit only */
    }
  }, [preferences])

  const value = useMemo<Value>(
    () => ({ preferences, setPreference: (key, v) => setPreferences((p) => ({ ...p, [key]: v })) }),
    [preferences],
  )
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): Value {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return ctx
}
