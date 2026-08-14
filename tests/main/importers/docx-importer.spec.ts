import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ convertToHtml: vi.fn() }))

vi.mock('mammoth', () => ({
  default: { convertToHtml: mocks.convertToHtml },
  convertToHtml: mocks.convertToHtml,
}))

describe('DOCX structured importer', () => {
  let directory: string

  beforeEach(async () => {
    vi.clearAllMocks()
    directory = await mkdtemp(path.join(os.tmpdir(), 'antessala-docx-import-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('converte com Mammoth, sanitiza o HTML e preserva avisos', async () => {
    const filePath = path.join(directory, 'treinamento.docx')
    await writeFile(filePath, Buffer.from('fake-docx'))
    mocks.convertToHtml.mockResolvedValue({
      value: '<h1>Treinamento Antessala</h1><script>malicioso()</script><p>Fluxo de classificação.</p>',
      messages: [{ type: 'warning', message: 'Imagem ignorada' }],
    })
    const { importDocxStructured } = await import('../../../src/main/importers/docx-importer')

    const result = await importDocxStructured(filePath)

    expect(mocks.convertToHtml).toHaveBeenCalledWith({ path: filePath })
    expect(result).toMatchObject({
      format: 'docx',
      suggestedTitle: 'Treinamento Antessala',
      warnings: [{ code: 'DOCX_CONVERSION_WARNING', message: 'Imagem ignorada' }],
    })
    expect(JSON.stringify(result)).not.toContain('malicioso')
    expect(result.tiptapJson.type).toBe('doc')
  })
})
