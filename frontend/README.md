# OpenPaper application

`src/` is the interface (React, TypeScript, Tailwind CSS 4, CodeMirror 6).
`src-tauri/` is the desktop side (Rust, Tauri 2).

See the repository README for how to run it, `documentation/architecture.md`
for how the two halves fit together, and `documentation/building.md` for
build requirements and installers.

## Interface layout

```
src/
  backend/      ProjectBackend interface; tauri.ts (desktop) and memory.ts (browser stand-in)
  app/          routes, open-project state, theme, preferences
  pages/        WorkspacePage: explorer, editor, preview, diagnostics; autosave and conflict handling
  editor/       CodeEditor, latexEditor (highlighting, folding, autocomplete), FileExplorer,
                PreviewPanel, BottomPanel, fileTypes
    latex/      source checks and the draft preview renderer
  dashboard/    AppShell, ProjectsPage, NewProjectDialog, SettingsPage
  templates/    templates.ts (14 templates in 10 categories), starterFiles.ts, library page
  components/ui shared building blocks, including Dialog and Splitter
  index.css     design tokens for light and dark themes
```

## Design system

Colours are semantic roles defined once in `src/index.css` and exposed as
Tailwind utilities (`bg-canvas`, `bg-surface`, `text-ink`, `text-body`,
`border-line`, `text-accent`, `bg-primary`). Dark mode swaps the variables
under `.dark`. Type: STIX Two Text (headings, draft pages), IBM Plex Sans
(interface), IBM Plex Mono (code); all bundled, none fetched.
