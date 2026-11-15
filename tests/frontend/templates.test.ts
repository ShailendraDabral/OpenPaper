// Every template must produce a starter project that passes OpenPaper's own source checks.
import { memoryBackend } from '../../frontend/src/backend/memory'
import { BackendError } from '../../frontend/src/backend/types'
import { findRootFile, isTextPath } from '../../frontend/src/editor/fileTypes'
import { checkProject } from '../../frontend/src/editor/latex/check'
import { starterFiles } from '../../frontend/src/templates/starterFiles'
import { templateCategories, templates } from '../../frontend/src/templates/templates'

const asProject = (files: { path: string; content: string }[]) => Object.fromEntries(files.map((f) => [f.path, f.content]))

describe('template starter files', () => {
  it('covers every category', () => {
    for (const category of templateCategories) expect(templates.some((t) => t.category === category), category).toBe(true)
  })

  it.each([undefined, ...templates].map((t) => [t?.name ?? 'Blank article', t] as const))('%s starts clean', (_name, template) => {
    const files = asProject(starterFiles(template, 'My Paper'))
    const root = findRootFile(files)
    expect(root).toBe('main.tex')
    const result = checkProject(files, root)
    expect(result.issues).toEqual([])
    expect(result.blocks.some((b) => b.type === 'title' && b.html === 'My Paper')).toBe(true)
    expect(result.blocks.some((b) => b.type === 'bibliography' && b.entries.length === 1)).toBe(true)
    expect(files['references.bib']).toContain('@article{example2024')
  })

  it('uses the publisher class when TeX distributions include it', () => {
    const main = (name: string) => asProject(starterFiles(templates.find((t) => t.name === name), 'T'))['main.tex']
    expect(main('IEEE conference paper')).toContain('\\documentclass[conference]{IEEEtran}')
    expect(main('ACM conference paper')).toContain('\\documentclass[sigconf]{acmart}')
    expect(main('Elsevier article, single column')).toContain('\\begin{frontmatter}')
  })

  it('falls back to article, with a note, when the class comes from an author kit', () => {
    for (const template of templates.filter((t) => t.authorKit)) {
      const main = asProject(starterFiles(template, 'T'))['main.tex']
      expect(main).toContain('\\documentclass[11pt]{article}')
      expect(main).toContain("publisher's author kit")
    }
  })

  it('splits a thesis into chapter files', () => {
    const files = asProject(starterFiles(templates.find((t) => t.name === 'Doctoral thesis'), 'T'))
    expect(Object.keys(files).sort()).toEqual(['chapters/conclusion.tex', 'chapters/introduction.tex', 'chapters/methods.tex', 'chapters/results.tex', 'main.tex', 'references.bib'])
    const headings = checkProject(files, 'main.tex').blocks.filter((b) => b.type === 'heading')
    expect(headings.map((h) => h.type === 'heading' && h.number)).toEqual(['', '1', '2', '3', '4'])
  })

  it('escapes LaTeX special characters in the title', () => {
    expect(asProject(starterFiles(undefined, 'R&D: 50% of $x_1$'))['main.tex']).toContain('\\title{R\\&D: 50\\% of \\$x\\_1\\$}')
  })
})

describe('file types', () => {
  it('knows which files are text', () => {
    expect(['main.tex', 'refs.bib', 'a/b/style.sty', 'README', '.gitignore', 'notes.md'].every(isTextPath)).toBe(true)
    expect(['fig.pdf', 'plot.png', 'data.xlsx', 'archive'].some(isTextPath)).toBe(false)
  })

  it('finds the root file', () => {
    expect(findRootFile({ 'main.tex': '', 'a.tex': '\\documentclass{article}' })).toBe('main.tex')
    expect(findRootFile({ 'chapters/one.tex': 'text', 'thesis.tex': '\\documentclass{book}' })).toBe('thesis.tex')
    expect(findRootFile({ 'notes.md': '', 'fig.pdf': null })).toBeNull()
  })
})

describe('browser stand-in backend', () => {
  it('behaves like the desktop backend for saves and conflicts', async () => {
    await memoryBackend.createProject('test-project', [{ path: 'main.tex', content: 'one' }])
    const first = await memoryBackend.readTextFile('main.tex')
    const saved = await memoryBackend.writeTextFile('main.tex', 'two', first.modifiedMs)
    expect((await memoryBackend.readTextFile('main.tex')).content).toBe('two')
    // Saving against a stale modification time is refused.
    await expect(memoryBackend.writeTextFile('main.tex', 'three', first.modifiedMs)).rejects.toMatchObject({ kind: 'conflict' })
    await memoryBackend.writeTextFile('main.tex', 'three', saved)
    await expect(memoryBackend.createFile('main.tex')).rejects.toBeInstanceOf(BackendError)
    await expect(memoryBackend.writeTextFile('../escape.tex', 'x')).rejects.toMatchObject({ kind: 'invalidPath' })
    await memoryBackend.createFolder('figures')
    expect((await memoryBackend.listFiles()).entries.map((e) => e.path)).toEqual(['figures', 'main.tex'])
  })
})
