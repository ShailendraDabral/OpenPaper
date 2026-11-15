import { isTauri } from '@tauri-apps/api/core'
import { memoryBackend } from './memory'
import { tauriBackend } from './tauri'
import type { ProjectBackend } from './types'

/** Real folders in the desktop app; an in-memory stand-in in a plain browser. */
export const backend: ProjectBackend = isTauri() ? tauriBackend : memoryBackend
export const isDesktop = backend.kind === 'desktop'

export * from './types'
