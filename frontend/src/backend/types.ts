/**
 * The boundary between the interface and the computer.
 *
 * In the desktop app this is implemented by Rust commands (tauri.ts) that read
 * and write the user's project folder. In a plain browser there is no access
 * to the disk, so an in-memory stand-in (memory.ts) keeps the interface usable
 * for previews and development.
 */

export interface ProjectInfo {
  /** Absolute folder path, for display. */
  path: string
  name: string
}

export interface RecentProject extends ProjectInfo {
  openedMs: number
  /** False when the folder has been moved or deleted. */
  exists: boolean
}

export interface FileEntry {
  /** Path relative to the project, with forward slashes. */
  path: string
  isDir: boolean
  size: number
  modifiedMs: number
}

export interface Listing {
  entries: FileEntry[]
  /** The project has more files than can be listed. */
  truncated: boolean
}

export interface TextFile {
  content: string
  modifiedMs: number
}

export interface StarterFile {
  path: string
  content: string
}

export type BackendErrorKind = 'noProject' | 'invalidPath' | 'notFound' | 'alreadyExists' | 'tooLarge' | 'notText' | 'conflict' | 'io'

/** An error from the backend, with a message written for the user. */
export class BackendError extends Error {
  readonly kind: BackendErrorKind
  constructor(kind: BackendErrorKind, message: string) {
    super(message)
    this.name = 'BackendError'
    this.kind = kind
  }
}

export interface ProjectBackend {
  /** 'desktop': real folders on disk. 'browser': in memory, nothing is kept. */
  readonly kind: 'desktop' | 'browser'

  /** A project named on the command line when the app was started, if any. */
  initialProject(): Promise<ProjectInfo | null>
  /** Let the user choose a folder and open it. Null if they cancel. */
  pickProject(): Promise<ProjectInfo | null>
  openRecent(path: string): Promise<ProjectInfo>
  /** Let the user choose where, then create the folder with starter files and open it. Null if they cancel. */
  createProject(name: string, files: StarterFile[]): Promise<ProjectInfo | null>
  closeProject(): Promise<void>
  recentProjects(): Promise<RecentProject[]>
  forgetRecent(path: string): Promise<void>

  /* Files of the open project. Paths are relative to its folder. */
  listFiles(): Promise<Listing>
  readTextFile(path: string): Promise<TextFile>
  /**
   * Save a file and return its new modification time. With `expectedModifiedMs`
   * the save is refused (kind 'conflict') if the file changed on disk since.
   */
  writeTextFile(path: string, content: string, expectedModifiedMs?: number): Promise<number>
  createFile(path: string): Promise<number>
  createFolder(path: string): Promise<void>
}
