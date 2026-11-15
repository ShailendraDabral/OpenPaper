import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/stix-two-text/400.css'
import '@fontsource/stix-two-text/400-italic.css'
import '@fontsource/stix-two-text/500.css'
import '@fontsource/stix-two-text/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { PreferencesProvider } from './app/PreferencesProvider'
import { ProjectProvider } from './app/ProjectProvider'
import { applyStoredTheme, ThemeProvider } from './app/ThemeProvider'
import './index.css'

// Fonts are bundled (imports above): the app works with no internet connection.
applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PreferencesProvider>
        <HashRouter>
          <ProjectProvider>
            <App />
          </ProjectProvider>
        </HashRouter>
      </PreferencesProvider>
    </ThemeProvider>
  </StrictMode>,
)
