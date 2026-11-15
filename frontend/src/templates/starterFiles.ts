import type { StarterFile } from '../backend/types'
import type { Template } from './templates'

/**
 * The files a new project starts with. Each template uses its publisher's
 * document class when that class ships with standard TeX distributions; for
 * the others the starter uses `article` and says which file to add.
 */

const R = String.raw

const references = R`@article{example2024,
  author  = {Author, A. and Coauthor, B.},
  title   = {Title of an example article},
  journal = {Journal Name},
  volume  = {1},
  pages   = {1--10},
  year    = {2024}
}
`

const body = R`\section{Introduction}
\label{sec:introduction}

Introduce the problem and say why it matters. Cite earlier work like
this~\cite{example2024}.

\section{Method}
\label{sec:method}

Describe what you did. Equations are numbered and can be referred to, as
in Eq.~(\ref{eq:example}):
\begin{equation}
  E = m c^2
  \label{eq:example}
\end{equation}

\section{Results}
\label{sec:results}

Report what you found. Table~\ref{tab:example} shows how a table is set.

\begin{table}[t]
  \centering
  \caption{An example table.}
  \label{tab:example}
  \begin{tabular}{lcc}
    \hline
    Sample & Value & Uncertainty \\
    \hline
    A & 1.0 & 0.1 \\
    B & 2.0 & 0.2 \\
    \hline
  \end{tabular}
\end{table}

\section{Conclusion}
\label{sec:conclusion}

Summarise the result and what follows from it.
`

const abstractText = 'Summarise the question, the method and the main result in a few sentences.'

function kitNote(template: Template): string {
  if (!template.authorKit) return ''
  return [
    `% ${template.name}`,
    `% This format needs ${template.authorKit} from the publisher's author kit, which is`,
    '% not part of standard TeX distributions. Until you add it to this folder, the',
    '% project uses the plain article class so that it compiles. After adding it,',
    '% replace the \\documentclass line below with the one from the kit.',
    '',
    '',
  ].join('\n')
}

function paper(template: Template | undefined, title: string): string {
  const classLine = template?.classLine ?? R`\documentclass[11pt]{article}`
  const bibliography = `\\bibliographystyle{${template?.bibStyle ?? 'plain'}}\n\\bibliography{references}`
  const end = `${body}\n${bibliography}\n\n\\end{document}\n`
  const head = `${template ? kitNote(template) : ''}${classLine}\n`

  switch (template?.frontMatter) {
    case 'elsarticle':
      return `${head}
\\begin{document}

\\begin{frontmatter}

\\title{${title}}
\\author{Author Name}
\\address{Institution, City, Country}

\\begin{abstract}
${abstractText}
\\end{abstract}

\\begin{keyword}
first keyword \\sep second keyword
\\end{keyword}

\\end{frontmatter}

${end}`
    case 'acmart':
      return `${head}
\\title{${title}}
\\author{Author Name}
\\affiliation{\\institution{Institution}\\city{City}\\country{Country}}
\\email{author@example.org}

\\begin{document}

% acmart expects the abstract before \\maketitle.
\\begin{abstract}
${abstractText}
\\end{abstract}

\\maketitle

${end}`
    case 'llncs':
      return `${head}
\\title{${title}}
\\author{Author Name}
\\institute{Institution, City, Country\\\\ \\email{author@example.org}}

\\begin{document}
\\maketitle

\\begin{abstract}
${abstractText}
\\keywords{First keyword \\and Second keyword}
\\end{abstract}

${end}`
    default:
      return `${head}
\\title{${title}}
\\author{Author Name}

\\begin{document}
\\maketitle

\\begin{abstract}
${abstractText}
\\end{abstract}

${end}`
  }
}

function thesis(template: Template, title: string): StarterFile[] {
  const chapters = [
    ['introduction', 'Introduction', 'State the research question and outline the thesis. Cite earlier work like this~\\cite{example2024}.'],
    ['methods', 'Methods', 'Describe the methods used.'],
    ['results', 'Results', 'Present the results.'],
    ['conclusion', 'Conclusion', 'Summarise the contribution and open questions.'],
  ]
  const main = `${template.classLine}

\\title{${title}}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\chapter*{Abstract}
${abstractText}

\\tableofcontents

${chapters.map(([file]) => `\\input{chapters/${file}}`).join('\n')}

\\bibliographystyle{${template.bibStyle}}
\\bibliography{references}

\\end{document}
`
  return [
    { path: 'main.tex', content: main },
    ...chapters.map(([file, heading, text]) => ({
      path: `chapters/${file}.tex`,
      content: `\\chapter{${heading}}\n\\label{ch:${file}}\n\n${text}\n`,
    })),
    { path: 'references.bib', content: references },
  ]
}

/** LaTeX special characters in a title typed by the user. */
const escapeTitle = (title: string) => title.replace(/([&%$#_])/g, '\\$1')

export function starterFiles(template: Template | undefined, title: string): StarterFile[] {
  const safeTitle = escapeTitle(title)
  if (template?.frontMatter === 'thesis') return thesis(template, safeTitle)
  return [
    { path: 'main.tex', content: paper(template, safeTitle) },
    { path: 'references.bib', content: references },
  ]
}
