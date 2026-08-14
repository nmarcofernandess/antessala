import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ pdfParse: vi.fn() }))
vi.mock('pdf-parse', () => ({ default: mocks.pdfParse }))

describe('PDF structured importer', () => {
  let directory: string

  beforeEach(async () => {
    vi.clearAllMocks()
    directory = await mkdtemp(path.join(os.tmpdir(), 'antessala-pdf-import-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('preserva cada página e marca página vazia como OCR-needed', async () => {
    const filePath = path.join(directory, 'manual.pdf')
    await writeFile(filePath, Buffer.from('%PDF fake'))
    mocks.pdfParse.mockImplementation(async (_buffer: Buffer, options: { pagerender: (page: unknown) => Promise<string> }) => {
      const pages = [
        { getTextContent: async () => ({ items: [{ str: 'Página um com protocolo.' }] }) },
        { getTextContent: async () => ({ items: [] }) },
        { getTextContent: async () => ({ items: [{ str: 'Página três com agenda.' }] }) },
      ]
      for (const page of pages) await options.pagerender(page)
      return { text: 'Página um com protocolo.\n\nPágina três com agenda.', numpages: 3, info: { Title: 'Manual de treinamento', Author: 'Antessala' } }
    })
    const { importPdfStructured } = await import('../../../src/main/importers/pdf-importer')

    const result = await importPdfStructured(filePath)

    expect(result.pages).toHaveLength(3)
    expect(result.pages[1]).toMatchObject({ number: 2, text: '', wordCount: 0 })
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'OCR_NEEDED', page: 2 }))
    expect(result.markdown).toContain('## Página 1')
    expect(result.markdown).toContain('## Página 3')
    expect(result.suggestedTitle).toBe('Manual de treinamento')
  })
})
