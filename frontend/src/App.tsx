import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useProject } from './app/ProjectProvider'
import { routes } from './app/site'
import { AppShell } from './dashboard/AppShell'
import { ProjectsPage } from './dashboard/pages/ProjectsPage'
import { SettingsPage } from './dashboard/pages/SettingsPage'
import { TemplateLibraryPage } from './templates/TemplateLibraryPage'

// The workspace pulls in the code editor, so it loads only when a project is opened.
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })))

export function App() {
  const { project, starting } = useProject()
  if (starting) return null

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={routes.projects} element={<ProjectsPage />} />
        <Route path={routes.templates} element={<TemplateLibraryPage />} />
        <Route path={routes.settings} element={<SettingsPage />} />
      </Route>
      <Route
        path={routes.editor}
        element={
          project ? (
            <Suspense fallback={<p className="p-8 text-sm text-muted">Opening {project.name}…</p>}>
              <WorkspacePage key={project.path} project={project} />
            </Suspense>
          ) : (
            <Navigate to={routes.projects} replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={routes.projects} replace />} />
    </Routes>
  )
}
