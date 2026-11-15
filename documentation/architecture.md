# Architecture

OpenPaper is a desktop application. A Rust process owns everything that
touches the computer; a web view shows the interface. The two talk only
through a fixed list of commands.

```
┌──────────────── OpenPaper window ────────────────┐
│  Interface (React, CodeMirror)   frontend/src    │
│    explorer │ editor │ preview │ diagnostics     │
└───────────────────────┬──────────────────────────┘
                        │ Tauri commands (IPC)
┌───────────────────────┴──────────────────────────┐
│  Desktop side (Rust)             frontend/src-tauri
│    paths.rs    validate every path                │
│    project.rs  list, read, write, create          │
│    recent.rs   recently opened folders            │
└───────────────────────┬──────────────────────────┘
                        │
                 the project folder
```

## Projects are folders

A project is whatever folder the user opens or creates. OpenPaper adds no
database and no hidden index to it; the files are the source of truth, so the
folder works equally well with Git, a sync client or another editor.

* **Listing** skips `.git`, `node_modules` and `.openpaper`, and does not follow
  symbolic links.
* **Reading**: text files up to 2 MB are opened; other files are listed but not
  loaded.
* **Saving** is automatic, about 0.7 s after the last keystroke, when the window
  loses focus and on Ctrl/Cmd+S. Each save writes a temporary file and renames
  it into place, so a crash cannot leave a half-written document.
* **Changes made elsewhere**: every save carries the modification time the
  editor last saw. If the file on disk differs, the save is refused and the
  user chooses which version to keep. The folder is also re-read every few
  seconds while the window is visible, so files changed, added or removed by
  other programs appear without a restart.

The list of recent projects is a small JSON file in the system's application
data folder. (SQLite arrives with the features that need a real database:
the reference library and version history.)

## Security model

The interface is treated as untrusted, as if a malicious document could take
control of it. What it can do is limited by the desktop side:

* **No general file, shell or network access.** The only capability granted to
  the window is Tauri's core set. File access exists only as OpenPaper's own
  commands.
* **The interface cannot choose which folder is open.** A folder becomes the
  project in three ways only: the native folder dialog (opened by Rust), the
  recent list (folders chosen before), or the command line. `open_recent`
  refuses paths that are not on the list.
* **Every path is relative to the project and validated** (`paths.rs`):
  absolute paths, `..`, drive letters and backslashes are rejected, and the
  real location after following symbolic links must still be inside the
  project folder.
* **Content Security Policy** allows scripts, styles, fonts and images only
  from the application bundle. Fonts are bundled, so nothing is fetched from
  the network.

When the compiler is added, it will follow the same approach: a fixed list of
programs, arguments built by Rust rather than passed through a shell, the
project folder as working directory, and shell-escape off.

## The boundary in code

`frontend/src/backend/types.ts` defines `ProjectBackend`, the complete list of
things the interface can ask for. It has two implementations:

* `tauri.ts` calls the Rust commands. This is the application.
* `memory.ts` keeps files in memory, for running the interface in a plain
  browser during development or as a preview. Nothing it does is saved.

## What the right-hand panel shows today

There is no compiler yet, so no PDF. The panel shows a draft that OpenPaper
draws from the LaTeX source (`editor/latex/render.ts`), and says so. The
bottom panel lists problems found by OpenPaper's own source checks
(`editor/latex/check.ts`). Both will be replaced or joined by real compiler
output; `CheckResult` is the shape the panels consume.

## Planned order

1. Desktop foundation and project management (this version).
2. Local compiler: detect MiKTeX, TeX Live and MacTeX; Tectonic as the
   built-in default; pdfLaTeX, XeLaTeX, LuaLaTeX; real logs.
3. PDF viewer (PDF.js) with source/PDF jumping.
4. Bibliography manager and local version history (SQLite, Git).
5. Optional: AI assistant with the user's own key or a local model; GitHub.
6. Later, separately: real-time collaboration.
