import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend, type ProjectInfo, type StarterFile } from '../backend'
import { routes } from './site'

interface ProjectValue {
  /** The open project, or null on the Projects screen. */
  project: ProjectInfo | null
  /** True until the app knows whether it was started with a project. */
  starting: boolean
  /** Why the last open or create failed, in words for the user. */
  error: string
  clearError: () => void
  /** Show the folder dialog and open the chosen folder. */
  openFolder: () => Promise<void>
  openRecent: (path: string) => Promise<void>
  /** Create a project folder with starter files. Resolves false if the user cancelled the folder dialog. */
  createProject: (name: string, files: StarterFile[]) => Promise<boolean>
  closeProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectValue | null>(null)

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

/** Which project folder is open. Opening one moves to the workspace. */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const asked = useRef(false)

  const enter = useCallback(
    (info: ProjectInfo) => {
      setError('')
      setProject(info)
      navigate(routes.editor)
    },
    [navigate],
  )

  // Started as `openpaper path/to/folder`? Then go straight to that project.
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    backend
      .initialProject()
      .then((info) => info && enter(info))
      .catch((e) => setError(messageOf(e)))
      .finally(() => setStarting(false))
  }, [enter])

  const value = useMemo<ProjectValue>(
    () => ({
      project,
      starting,
      error,
      clearError: () => setError(''),
      openFolder: async () => {
        try {
          const info = await backend.pickProject()
          if (info) enter(info)
        } catch (e) {
          setError(messageOf(e))
        }
      },
      openRecent: async (path) => {
        try {
          enter(await backend.openRecent(path))
        } catch (e) {
          setError(messageOf(e))
        }
      },
      createProject: async (name, files) => {
        const info = await backend.createProject(name, files)
        if (!info) return false
        enter(info)
        return true
      },
      closeProject: async () => {
        await backend.closeProject().catch(() => undefined)
        setProject(null)
        navigate(routes.projects)
      },
    }),
    [project, starting, error, enter, navigate],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>')
  return ctx
}
