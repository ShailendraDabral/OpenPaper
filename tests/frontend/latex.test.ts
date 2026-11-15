// Unit tests for the source checks and the draft preview renderer.
// Run from frontend/: npm test   (describe / it / expect are Vitest globals)
import { checkProject } from '../../frontend/src/editor/latex/check'
import { parseBib } from '../../frontend/src/editor/latex/source'
import { sampleFiles } from '../../frontend/src/backend/memory'

const rootFile = 'main.tex'

const main = sampleFiles[rootFile] as string
const withMain = (text: string) => ({ ...sampleFiles, [rootFile]: text })
const messages = (files: typeof sampleFiles) => checkProject(files, rootFile).issues.map((i) => `${i.severity}: ${i.message}`)

describe('source checks', () => {
  it('reports the one known warning in the sample project', () => {
    const result = checkProject(sampleFiles, rootFile)
    expect(result.errors).toBe(0)
    expect(result.warnings).toBe(1)
    expect(result.issues[0]).toMatchObject({ file: 'sections/method.tex', line: 8, severity: 'warning' })
  })

  it('flags an environment that is never closed', () => {
    expect(messages(withMain(main.replace('\\end{abstract}', '')))).toContain('error: \\begin{abstract} is never closed.')
  })

  it('flags a stray closing brace', () => {
    expect(messages(withMain(main.replace('\\maketitle', '\\maketitle }')))).toContain(
      'error: Unexpected }. There is no { for it to close.',
    )
  })

  it('flags citations that are not in the bibliography', () => {
    const result = checkProject(withMain(main.replace('\\printbibliography', '\\cite{nobody1999}\n\\printbibliography')), rootFile)
    expect(result.issues.some((i) => i.message.includes('"nobody1999"') && i.severity === 'warning')).toBe(true)
  })

  it('flags missing input and figure files as errors', () => {
    const result = checkProject(
      withMain(main.replace('\\printbibliography', '\\input{sections/missing}\n\\includegraphics{figures/none}')),
      rootFile,
    )
    expect(result.errors).toBe(2)
  })

  it('treats a folder without LaTeX sources as nothing to check', () => {
    const result = checkProject({ 'notes.md': 'hello' }, null)
    expect(result.errors).toBe(0)
    expect(result.blocks).toEqual([])
    expect(result.log).toContain('No .tex file found')
  })
})

describe('preview renderer', () => {
  const blocks = checkProject(sampleFiles, rootFile).blocks

  it('builds the document structure in order', () => {
    expect(blocks.map((b) => b.type).slice(0, 4)).toEqual(['title', 'abstract', 'heading', 'para'])
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(3)
  })

  it('numbers citations by first appearance and resolves references', () => {
    const text = blocks.map((b) => ('html' in b ? b.html : '')).join(' ')
    expect(text).toContain('[1]')
    expect(text).toContain('[2]')
    expect(text).toContain('Table&nbsp;1')
    expect(text).toContain('<b>??</b>') // the undefined \ref in the sample
  })

  it('reads a tabular into rows and cells', () => {
    const table = blocks.find((b) => b.type === 'table')
    expect(table?.type === 'table' && table.rows).toHaveLength(4)
  })

  it('escapes HTML in the source', () => {
    const result = checkProject(withMain(main.replace('We measure', '<script>x</script> We measure')), rootFile)
    const abstract = result.blocks.find((b) => b.type === 'abstract')
    expect(abstract?.type === 'abstract' && abstract.html).toContain('&lt;script&gt;')
  })
})

describe('BibTeX parsing', () => {
  it('reads keys and fields', () => {
    const [entry] = parseBib('@article{doe2020,\n  author = {Doe, J.},\n  title = {A {Test} entry},\n  year = {2020}\n}')
    expect(entry.key).toBe('doe2020')
    expect(entry.fields).toMatchObject({ author: 'Doe, J.', title: 'A Test entry', year: '2020' })
  })
})
