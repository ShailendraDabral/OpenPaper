import { BackendError, type FileEntry, type ProjectBackend, type ProjectInfo, type StarterFile } from './types'

/**
 * Browser stand-in for the desktop backend. A plain web page cannot read or
 * write folders, so projects here live in memory and vanish on reload. It
 * exists for previews and interface development; the real application is the
 * desktop build.
 */

/** The sample project shown in the browser preview. */
export const sampleFiles: Record<string, string | null> = {
  'main.tex': String.raw`\documentclass[11pt]{article}
\usepackage{amsmath, graphicx, booktabs, siunitx}
\usepackage[style=numeric]{biblatex}
\addbibresource{references.bib}

\title{Thermal Transport in Twisted Bilayer Lattices}
\author{R. Iyer \and M. Okafor \and L. Brandt}

\begin{document}
\maketitle

\begin{abstract}
  We measure the in-plane thermal conductivity of twisted
  bilayer lattices and show that it falls sharply at small
  twist angles, where interlayer phonon scattering dominates.
\end{abstract}

\input{sections/introduction}
\input{sections/method}
\input{sections/results}

\printbibliography
\end{document}
`,
  'sections/introduction.tex': String.raw`\section{Introduction}
\label{sec:intro}

Heat flow in layered materials depends on how phonons
scatter at the interface~\cite{iyer2025}. In the kinetic
picture the conductivity is
\begin{equation}
  \kappa = \frac{1}{3}\, C\, v\, \ell
  \label{eq:kinetic}
\end{equation}
where $C$ is the heat capacity, $v$ the group velocity
and $\ell$ the phonon mean free path.

Twisting one layer against the other changes $\ell$ without
changing the chemistry of the sample~\cite{okafor2024}, which
makes the twist angle $\theta$ a clean control parameter.
`,
  'sections/method.tex': String.raw`\section{Method}
\label{sec:method}

% TODO: describe the calibration run
Samples were prepared by tear-and-stack assembly and
measured with a suspended micro-bridge between
\SI{20}{\kelvin} and \SI{300}{\kelvin}, following the
procedure in Section~\ref{sec:calibration}.

\begin{figure}[t]
  \centering
  \includegraphics[width=0.8\linewidth]{figures/bridge}
  \caption{Suspended micro-bridge geometry. The sample
    spans two thermally isolated pads.}
  \label{fig:bridge}
\end{figure}
`,
  'sections/results.tex': String.raw`\section{Results}
\label{sec:results}

Table~\ref{tab:samples} lists the samples. The conductivity
drops by a factor of three between $\theta = 5.0$ and
$\theta = 1.1$ degrees (Figure~\ref{fig:kappa}), consistent
with Eq.~\eqref{eq:kinetic} if only $\ell$ changes.

\input{tables/samples}

\begin{figure}[t]
  \centering
  \includegraphics[width=0.8\linewidth]{figures/conductivity}
  \caption{Thermal conductivity against twist angle at
    \SI{300}{\kelvin}.}
  \label{fig:kappa}
\end{figure}
`,
  'tables/samples.tex': String.raw`\begin{table}[t]
  \centering
  \caption{Samples measured in this work.}
  \label{tab:samples}
  \begin{tabular}{lcc}
    \toprule
    Sample & Twist angle (deg) & $\kappa$ (W/mK) \\
    \midrule
    A & 5.0 & 1480 \\
    B & 2.3 & 910 \\
    C & 1.1 & 470 \\
    \bottomrule
  \end{tabular}
\end{table}
`,
  'references.bib': String.raw`@article{iyer2025,
  author  = {Iyer, R. and Brandt, L.},
  title   = {Interlayer phonon scattering in twisted lattices},
  journal = {Journal of Thermal Physics},
  volume  = {12},
  pages   = {101--118},
  year    = {2025}
}

@article{okafor2024,
  author  = {Okafor, M.},
  title   = {Twist-angle control of the phonon mean free path},
  journal = {Letters in Condensed Matter},
  volume  = {8},
  pages   = {44--52},
  year    = {2024}
}
`,
  'figures/bridge.pdf': null,
  'figures/conductivity.pdf': null,
}

interface MemoryProject {
  info: ProjectInfo
  /** Text content, or null for a binary file. */
  files: Map<string, { content: string | null; modifiedMs: number }>
  folders: Set<string>
  openedMs: number
}

let clock = Date.now()
const tick = () => ++clock

function makeProject(name: string, files: Record<string, string | null>): MemoryProject {
  const project: MemoryProject = { info: { path: `(in memory)/${name}`, name }, files: new Map(), folders: new Set(), openedMs: tick() }
  for (const [path, content] of Object.entries(files)) addFile(project, path, content)
  return project
}

function addFile(project: MemoryProject, path: string, content: string | null) {
  project.files.set(path, { content, modifiedMs: tick() })
  const parts = path.split('/')
  for (let i = 1; i < parts.length; i++) project.folders.add(parts.slice(0, i).join('/'))
}

const projects = new Map<string, MemoryProject>()
const sample = makeProject('thermal-transport', sampleFiles)
projects.set(sample.info.path, sample)
let current: MemoryProject | null = null

function open(project: MemoryProject): ProjectInfo {
  project.openedMs = tick()
  current = project
  return project.info
}

function need(): MemoryProject {
  if (!current) throw new BackendError('noProject', 'No project is open.')
  return current
}

const validPath = (path: string) => path.length > 0 && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && !/[\\:]/.test(part))

export const memoryBackend: ProjectBackend = {
  kind: 'browser',
  initialProject: async () => null,
  // There is no folder dialog in a browser: "open" opens the sample project.
  pickProject: async () => open(sample),
  openRecent: async (path) => {
    const project = projects.get(path)
    if (!project) throw new BackendError('notFound', 'That project is no longer available.')
    return open(project)
  },
  createProject: async (name, files: StarterFile[]) => {
    const project = makeProject(name, Object.fromEntries(files.map((f) => [f.path, f.content])))
    if (projects.has(project.info.path)) throw new BackendError('alreadyExists', `A project named "${name}" already exists.`)
    projects.set(project.info.path, project)
    return open(project)
  },
  closeProject: async () => {
    current = null
  },
  recentProjects: async () =>
    [...projects.values()].sort((a, b) => b.openedMs - a.openedMs).map((p) => ({ ...p.info, openedMs: p.openedMs, exists: true })),
  forgetRecent: async (path) => {
    if (path !== sample.info.path) projects.delete(path)
  },

  listFiles: async () => {
    const project = need()
    const entries: FileEntry[] = [
      ...[...project.folders].map((path) => ({ path, isDir: true, size: 0, modifiedMs: 0 })),
      ...[...project.files].map(([path, f]) => ({ path, isDir: false, size: f.content?.length ?? 0, modifiedMs: f.modifiedMs })),
    ].sort((a, b) => a.path.localeCompare(b.path))
    return { entries, truncated: false }
  },
  readTextFile: async (path) => {
    const file = need().files.get(path)
    if (!file) throw new BackendError('notFound', `"${path}" no longer exists.`)
    if (file.content === null) throw new BackendError('notText', `"${path}" is not UTF-8 text.`)
    return { content: file.content, modifiedMs: file.modifiedMs }
  },
  writeTextFile: async (path, content, expectedModifiedMs) => {
    const project = need()
    if (!validPath(path)) throw new BackendError('invalidPath', `"${path}" is not a valid path inside the project.`)
    const existing = project.files.get(path)
    if (expectedModifiedMs !== undefined && existing?.modifiedMs !== expectedModifiedMs) {
      throw new BackendError('conflict', `"${path}" was changed outside OpenPaper.`)
    }
    addFile(project, path, content)
    return project.files.get(path)!.modifiedMs
  },
  createFile: async (path) => {
    const project = need()
    if (!validPath(path)) throw new BackendError('invalidPath', `"${path}" is not a valid path inside the project.`)
    if (project.files.has(path) || project.folders.has(path)) throw new BackendError('alreadyExists', `"${path}" already exists.`)
    addFile(project, path, '')
    return project.files.get(path)!.modifiedMs
  },
  createFolder: async (path) => {
    const project = need()
    if (!validPath(path)) throw new BackendError('invalidPath', `"${path}" is not a valid path inside the project.`)
    if (project.files.has(path) || project.folders.has(path)) throw new BackendError('alreadyExists', `"${path}" already exists.`)
    addFile(project, `${path}/.keep`, null)
    project.files.delete(`${path}/.keep`)
  },
}
