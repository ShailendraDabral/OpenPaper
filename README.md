# OpenPaper

A free, open-source desktop application for academic writing in LaTeX.
Projects are ordinary folders on your computer. Nothing is uploaded, no
account is needed, and it works offline.

Built with Tauri 2 (Rust) and React, TypeScript, Tailwind CSS and CodeMirror 6.

## Status: desktop foundation

| Capability | State |
| --- | --- |
| Desktop app for Windows, macOS and Linux | Builds and runs on Linux; Windows and macOS builds are set up in CI but have not been run yet |
| Create a project in a folder, from 14 academic templates | Working |
| Open any existing folder; recent projects | Working |
| Edit with highlighting, folding, search, autocomplete | Working |
| Autosave to disk | Working |
| Notice changes made by other programs; never overwrite them silently | Working |
| Source checks (unclosed environments, unknown citations and labels, missing files) | Working |
| **LaTeX compilation to PDF** | **Not built yet. Next step.** |
| PDF viewer | Not built yet. Until then the right panel shows a draft drawn from the source, labelled as such |
| Bibliography manager, version history | Not built yet |
| AI assistant, GitHub integration | Planned, optional |
| Real-time collaboration | Later, as a separate project |

## Run it

You need Node.js 22, Rust (stable) and, on Linux, the WebKitGTK development
libraries. `documentation/building.md` has the details for each system.

```bash
cd frontend
npm install
npm run desktop:dev      # run the app with live reload
npm run desktop:build    # build an installer for this system
npm test                 # interface tests
cd src-tauri && cargo test   # Rust tests
```

`openpaper path/to/folder` opens that folder directly.

## Layout

```
frontend/              the application
  src/                 interface (React)
    backend/           the boundary to the computer: Rust commands in the desktop app,
                       an in-memory stand-in in a plain browser
    editor/            code editor, project explorer, preview, diagnostics, source checks
    dashboard/         project manager, new-project dialog, settings
    templates/         template library and starter files
    components/, pages/, app/, lib/
  src-tauri/           desktop side (Rust): file access, path validation, recent projects
documentation/         architecture and security model, build instructions
tests/                 interface tests (Rust tests live beside the Rust code)
.github/workflows/     tests on every push; installers for all three systems on a tag
```

## Licence

Not chosen yet. Until a LICENSE file is added, nobody has legal permission to
use or contribute to this code.
