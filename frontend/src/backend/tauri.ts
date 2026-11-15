import { invoke } from '@tauri-apps/api/core'
import {
  BackendError,
  type BackendErrorKind,
  type CompilerInfo,
  type CompileResult,
  type Listing,
  type ProjectBackend,
  type ProjectInfo,
  type RecentProject,
  type TextFile,
} from './types'

/** Call a Rust command, turning its `{ kind, message }` errors into BackendError. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e && 'message' in e) {
      throw new BackendError(e.kind as BackendErrorKind, String(e.message))
    }
    throw new BackendError('io', typeof e === 'string' ? e : 'Something went wrong talking to the application.')
  }
}

/** The desktop backend: Rust commands working on the user's project folder. */
export const tauriBackend: ProjectBackend = {
  kind: 'desktop',
  initialProject: () => call<ProjectInfo | null>('initial_project'),
  pickProject: () => call<ProjectInfo | null>('pick_project'),
  openRecent: (path) => call<ProjectInfo>('open_recent', { path }),
  createProject: (name, files) => call<ProjectInfo | null>('create_project', { name, files }),
  closeProject: () => call<void>('close_project'),
  recentProjects: () => call<RecentProject[]>('recent_projects'),
  forgetRecent: (path) => call<void>('forget_recent', { path }),
  listFiles: () => call<Listing>('list_files'),
  readTextFile: (path) => call<TextFile>('read_text_file', { path }),
  writeTextFile: (path, content, expectedModifiedMs) => call<number>('write_text_file', { path, content, expectedModifiedMs: expectedModifiedMs ?? null }),
  createFile: (path) => call<number>('create_file', { path }),
  createFolder: (path) => call<void>('create_folder', { path }),
  deleteFile: (path) => call<void>('delete_file', { path }),
  detectCompilers: () => call<CompilerInfo[]>('detect_compilers'),
  compileProject: (rootFile, compilerPath) => call<CompileResult>('compile_project', { rootFile, compilerPath: compilerPath ?? null }),
  readPdf: async (filename) => {
    const raw = await call<number[]>('read_pdf', { filename })
    return new Uint8Array(raw)
  },
  installTectonic: () => call<string>('install_tectonic'),
}
