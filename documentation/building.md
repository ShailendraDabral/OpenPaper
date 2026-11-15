# Building and installing

## What you need

| System | Requirements |
| --- | --- |
| All | Node.js 22 or newer, Rust (stable, via rustup.rs) |
| Windows 10/11 | Microsoft C++ Build Tools ("Desktop development with C++"). WebView2 is part of Windows 11 and current Windows 10. |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Linux (Debian/Ubuntu) | `sudo apt install libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |

Other Linux distributions: see the prerequisites page of the Tauri 2 documentation.

## Run from source

```bash
cd frontend
npm install
npm run desktop:dev
```

The first run compiles the Rust side and takes a few minutes.

## Build an installer for your own system

```bash
cd frontend
npm run desktop:build
```

The result is in `frontend/src-tauri/target/release/bundle/`:
`.msi` and `.exe` on Windows, `.dmg` and `.app` on macOS, `.deb`, `.rpm` and
`.AppImage` on Linux. An installer can only be built on the system it is for.

## Installers for all three systems

Push a tag such as `v0.1.0`, or run "Build installers" from the repository's
Actions tab. GitHub builds Windows, macOS (Apple silicon and Intel) and Linux
installers and attaches them to a draft release.

**This workflow has not been run yet.** Expect to fix small things the first time.

## Code signing

The installers are unsigned. On first launch Windows shows a SmartScreen
warning and macOS refuses to open the app until the user allows it in System
Settings. Removing those warnings needs a Windows code-signing certificate and
an Apple Developer membership, both paid, configured as secrets for the
release workflow.

## Tests

```bash
cd frontend
npm test                       # interface: source checks, templates, file types
cd src-tauri && cargo test     # Rust: path validation, file operations, recent list
```

## Browser preview

`npm run dev` (or `npm run build:preview` for one self-contained HTML file)
runs the interface in a browser with files kept in memory. It is for interface
development and demonstrations; it cannot open folders.
