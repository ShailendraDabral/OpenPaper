import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`          -> the interface, as loaded by the desktop app (dist/)
// `npm run build:preview`  -> one self-contained HTML file (dist-preview/) for sharing a
//                             browser preview; it has no disk access and keeps files in memory
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview'
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(preview ? [viteSingleFile()] : [])],
    build: { outDir: preview ? 'dist-preview' : 'dist', target: 'es2022' },
    // Fixed address: the desktop shell loads the dev server from here (see src-tauri/tauri.conf.json).
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    clearScreen: false,
  }
})
