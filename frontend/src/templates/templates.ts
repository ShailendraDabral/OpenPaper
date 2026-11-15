/** Academic templates, shared by the landing page, the dashboard and the template library. */

export const templateCategories = [
  'IEEE Transactions',
  'IEEE Conference',
  'Elsevier',
  'Springer Nature',
  'MDPI',
  'ACM',
  'Wiley',
  'arXiv',
  'PhD Thesis',
  "Master's Thesis",
] as const

export type TemplateCategory = (typeof templateCategories)[number]

/** Which miniature page to draw for a template or project. */
export type TemplateLayout = 'single' | 'two-column' | 'thesis' | 'slides' | 'proposal'

export interface Template {
  /** Unique, self-explanatory name, e.g. "IEEE conference paper". */
  name: string
  category: TemplateCategory
  layout: TemplateLayout
  /** Document class and the options that matter. */
  documentClass: string
  columns: 1 | 2
  /** How citations and the bibliography are set up. */
  references: string
  description: string
  /** The \\documentclass line of the starter project. */
  classLine: string
  /** Which title block the class expects. */
  frontMatter: 'standard' | 'elsarticle' | 'acmart' | 'llncs' | 'thesis'
  /** BibTeX style of the starter project. */
  bibStyle: string
  /**
   * Set when the class is not part of standard TeX distributions: the file the
   * author must add from the publisher's kit. The starter then uses `article`.
   */
  authorKit?: string
  /** What the starting project contains. */
  includes: string[]
  /** Shown on the landing page and dashboard home. */
  featured?: boolean
}

const paperParts = ['Title and author block', 'Abstract', 'Section skeleton with an equation and a table', 'references.bib with one example entry']
const thesisParts = ['Title page', 'Abstract and table of contents', 'One file per chapter', 'references.bib with one example entry']
const kitNote = (file: string) => `A note on adding ${file} from the publisher's author kit`

export const templates: Template[] = [
  {
    name: 'IEEE Transactions article',
    category: 'IEEE Transactions',
    layout: 'two-column',
    documentClass: 'IEEEtran, journal',
    columns: 2,
    references: 'Numeric, IEEEtran.bst',
    description: 'Two-column journal layout for IEEE Transactions and Journals, with index terms and author biographies.',
    classLine: '\\documentclass[journal]{IEEEtran}',
    frontMatter: 'standard',
    bibStyle: 'IEEEtran',
    includes: paperParts,
  },
  {
    name: 'IEEE Computer Society article',
    category: 'IEEE Transactions',
    layout: 'two-column',
    documentClass: 'IEEEtran, journal, compsoc',
    columns: 2,
    references: 'Numeric, IEEEtran.bst',
    description: 'The Computer Society variant of the Transactions layout, with its own fonts and heading style.',
    classLine: '\\documentclass[10pt,journal,compsoc]{IEEEtran}',
    frontMatter: 'standard',
    bibStyle: 'IEEEtran',
    includes: paperParts,
  },
  {
    name: 'IEEE conference paper',
    category: 'IEEE Conference',
    layout: 'two-column',
    documentClass: 'IEEEtran, conference',
    columns: 2,
    references: 'Numeric, IEEEtran.bst',
    description: 'Two-column proceedings layout used by most IEEE conferences.',
    classLine: '\\documentclass[conference]{IEEEtran}',
    frontMatter: 'standard',
    bibStyle: 'IEEEtran',
    includes: paperParts,
    featured: true,
  },
  {
    name: 'Elsevier article, single column',
    category: 'Elsevier',
    layout: 'single',
    documentClass: 'elsarticle, preprint',
    columns: 1,
    references: 'natbib, numeric or author-year',
    description: 'The elsarticle submission format: single column with generous spacing for review.',
    classLine: '\\documentclass[preprint,12pt]{elsarticle}',
    frontMatter: 'elsarticle',
    bibStyle: 'elsarticle-num',
    includes: [...paperParts, 'Keywords'],
    featured: true,
  },
  {
    name: 'Elsevier article, two-column',
    category: 'Elsevier',
    layout: 'two-column',
    documentClass: 'elsarticle, 5p',
    columns: 2,
    references: 'natbib, numeric or author-year',
    description: 'The elsarticle final-layout option that mirrors a two-column Elsevier journal page.',
    classLine: '\\documentclass[final,5p,times,twocolumn]{elsarticle}',
    frontMatter: 'elsarticle',
    bibStyle: 'elsarticle-num',
    includes: [...paperParts, 'Keywords'],
  },
  {
    name: 'Springer Nature journal article',
    category: 'Springer Nature',
    layout: 'single',
    documentClass: 'sn-jnl',
    columns: 1,
    references: 'Several styles, chosen as a class option',
    description: 'The Springer Nature journal class, with a choice of reference styles to match the target journal.',
    classLine: '\\documentclass[11pt]{article}',
    frontMatter: 'standard',
    bibStyle: 'plain',
    authorKit: 'sn-jnl.cls',
    includes: [...paperParts, kitNote('sn-jnl.cls')],
    featured: true,
  },
  {
    name: 'Springer LNCS proceedings paper',
    category: 'Springer Nature',
    layout: 'single',
    documentClass: 'llncs',
    columns: 1,
    references: 'Numeric, splncs04.bst',
    description: 'Lecture Notes in Computer Science: the compact single-column format for conference proceedings.',
    classLine: '\\documentclass[runningheads]{llncs}',
    frontMatter: 'llncs',
    bibStyle: 'splncs04',
    includes: [...paperParts, 'Keywords'],
  },
  {
    name: 'MDPI journal article',
    category: 'MDPI',
    layout: 'single',
    documentClass: 'mdpi',
    columns: 1,
    references: 'Numeric',
    description: 'The MDPI journal layout, with the back-matter statements MDPI journals ask for.',
    classLine: '\\documentclass[11pt]{article}',
    frontMatter: 'standard',
    bibStyle: 'plain',
    authorKit: 'mdpi.cls',
    includes: [...paperParts, kitNote('mdpi.cls')],
  },
  {
    name: 'ACM conference paper',
    category: 'ACM',
    layout: 'two-column',
    documentClass: 'acmart, sigconf',
    columns: 2,
    references: 'ACM Reference Format',
    description: 'The acmart proceedings format used across ACM conferences.',
    classLine: '\\documentclass[sigconf]{acmart}',
    frontMatter: 'acmart',
    bibStyle: 'ACM-Reference-Format',
    includes: [...paperParts, 'Affiliation and email'],
    featured: true,
  },
  {
    name: 'ACM journal article',
    category: 'ACM',
    layout: 'single',
    documentClass: 'acmart, acmsmall',
    columns: 1,
    references: 'ACM Reference Format',
    description: 'The acmart single-column format used by ACM journals and transactions.',
    classLine: '\\documentclass[acmsmall]{acmart}',
    frontMatter: 'acmart',
    bibStyle: 'ACM-Reference-Format',
    includes: [...paperParts, 'Affiliation and email'],
  },
  {
    name: 'Wiley journal article',
    category: 'Wiley',
    layout: 'single',
    documentClass: 'WileyNJD',
    columns: 1,
    references: 'Set by the target journal',
    description: 'The Wiley New Journal Design class for submissions to Wiley journals.',
    classLine: '\\documentclass[11pt]{article}',
    frontMatter: 'standard',
    bibStyle: 'plain',
    authorKit: 'the Wiley class file',
    includes: [...paperParts, kitNote('the class file')],
  },
  {
    name: 'arXiv preprint',
    category: 'arXiv',
    layout: 'single',
    documentClass: 'article',
    columns: 1,
    references: 'BibTeX, numeric',
    description: 'A clean single-column article that compiles with a standard TeX installation, ready to post as a preprint.',
    classLine: '\\documentclass[11pt]{article}',
    frontMatter: 'standard',
    bibStyle: 'plain',
    includes: paperParts,
    featured: true,
  },
  {
    name: 'Doctoral thesis',
    category: 'PhD Thesis',
    layout: 'thesis',
    documentClass: 'book',
    columns: 1,
    references: 'biblatex, one bibliography',
    description: 'A full thesis skeleton: front matter, one file per chapter, appendices and bibliography.',
    classLine: '\\documentclass[12pt,a4paper]{book}',
    frontMatter: 'thesis',
    bibStyle: 'plain',
    includes: thesisParts,
    featured: true,
  },
  {
    name: "Master's thesis",
    category: "Master's Thesis",
    layout: 'thesis',
    documentClass: 'report',
    columns: 1,
    references: 'biblatex, one bibliography',
    description: 'A shorter thesis skeleton with a title page, chapters and bibliography.',
    classLine: '\\documentclass[12pt,a4paper]{report}',
    frontMatter: 'thesis',
    bibStyle: 'plain',
    includes: thesisParts,
  },
]

export const featuredTemplates = templates.filter((t) => t.featured)
