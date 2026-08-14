import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectStructuredFormat, importStructuredDocument } from '../../../src/main/importers/structured-document-importer'

describe('structured document importer', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'antessala-structured-import-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it.each([
    ['arquivo.md', 'markdown'],
    ['arquivo.txt', 'text'],
    ['arquivo.html', 'html'],
    ['arquivo.csv', 'csv'],
    ['arquivo.json', 'json'],
    ['arquivo.jsonl', 'jsonl'],
    ['arquivo.pdf', 'pdf'],
    ['arquivo.docx', 'docx'],
  ] as const)('detecta %s como %s', (fileName, format) => {
    expect(detectStructuredFormat(fileName)).toBe(format)
  })

  it.each(['legado.doc', 'documento.odt', 'texto.rtf'])('recusa claramente %s', async (fileName) => {
    const filePath = path.join(directory, fileName)
    await writeFile(filePath, 'conteudo')

    await expect(importStructuredDocument(filePath)).rejects.toThrow(/não suportado.*converta.*PDF, DOCX, HTML, Markdown ou TXT/i)
  })

  it('preserva Markdown, sugere o primeiro heading e produz TipTap JSON', async () => {
    const filePath = path.join(directory, 'protocolo.md')
    await writeFile(filePath, '# Avaliação pré-anestésica\n\nHipertensão controlada não determina urgência.')

    const result = await importStructuredDocument(filePath)

    expect(result).toMatchObject({
      format: 'markdown',
      suggestedTitle: 'Avaliação pré-anestésica',
      wordCount: 7,
      warnings: [],
      metadata: { fileName: 'protocolo.md', extension: '.md' },
    })
    expect(result.markdown).toContain('# Avaliação pré-anestésica')
    expect(result.text).toContain('Hipertensão controlada')
    expect(result.tiptapJson.type).toBe('doc')
    expect(JSON.stringify(result.tiptapJson)).toContain('Avaliação pré-anestésica')
  })

  it('sanitiza HTML antes de produzir Markdown, texto e TipTap JSON', async () => {
    const filePath = path.join(directory, 'seguranca.html')
    await writeFile(filePath, '<h1>Guia seguro</h1><script>alert(1)</script><p onclick="roubar()">Conteúdo clínico</p>')

    const result = await importStructuredDocument(filePath)
    const serialized = JSON.stringify(result)

    expect(result.suggestedTitle).toBe('Guia seguro')
    expect(result.text).toContain('Conteúdo clínico')
    expect(serialized).not.toContain('<script')
    expect(serialized).not.toContain('alert(1)')
    expect(serialized).not.toContain('onclick')
  })

  it.each([
    ['dados.csv', 'nome,valor\nASA,externo', 'csv'],
    ['dados.json', '{"regra":"decisão humana"}', 'json'],
    ['dados.jsonl', '{"item":1}\n{"item":2}\n', 'jsonl'],
  ] as const)('importa %s como documento textual estruturado', async (fileName, content, format) => {
    const filePath = path.join(directory, fileName)
    await writeFile(filePath, content)

    const result = await importStructuredDocument(filePath)

    expect(result.format).toBe(format)
    expect(result.text).toContain(format === 'csv' ? 'nome,valor' : format === 'json' ? 'regra' : 'item')
    expect(result.tiptapJson.type).toBe('doc')
  })
})
