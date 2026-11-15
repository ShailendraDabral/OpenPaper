import { defineConfig } from 'vitest/config'

// Unit tests live in the repository's top-level tests/ folder.
export default defineConfig({
  test: {
    globals: true,
    dir: '../tests/frontend',
    include: ['**/*.test.ts'],
  },
  server: { fs: { allow: ['..'] } },
})
