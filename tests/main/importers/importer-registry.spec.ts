import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { detectFormat, importFile } from '../../../src/main/importers/importer-registry'

const FIXTURES = path.resolve(__dirname, '../../fixtures')

describe('detectFormat', () => {
  it('identifies .md as text', () => {
    expect(detectFormat('/any/path/readme.md')).toBe('text')
  })

  it('identifies .txt as text', () => {
    expect(detectFormat('/any/path/notes.txt')).toBe('text')
  })

  it('identifies .pdf as pdf', () => {
    expect(detectFormat('/any/path/doc.pdf')).toBe('pdf')
  })

  it('identifies .zip as zip', () => {
    expect(detectFormat('/any/path/export.zip')).toBe('zip')
  })

  it('identifies .json with "mapping" as chatgpt', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-chatgpt.json')
    fs.writeFileSync(tmpFile, JSON.stringify({ mapping: { abc: {} } }))
    try {
      expect(detectFormat(tmpFile)).toBe('chatgpt')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('identifies .json with "chat_messages" as claude', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-claude.json')
    fs.writeFileSync(tmpFile, JSON.stringify({ chat_messages: [] }))
    try {
      expect(detectFormat(tmpFile)).toBe('claude')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('identifies unknown .json as text', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-generic.json')
    fs.writeFileSync(tmpFile, JSON.stringify({ foo: 'bar' }))
    try {
      expect(detectFormat(tmpFile)).toBe('text')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('identifies .html as text', () => {
    expect(detectFormat('/any/path/page.html')).toBe('text')
  })
})

describe('importFile', () => {
  it('imports a .md file and returns text result', async () => {
    const samplePath = path.join(FIXTURES, 'sample.md')
    const result = await importFile(samplePath)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('Expected text result')

    expect(result.data.metadata.fileName).toBe('sample.md')
    expect(result.data.metadata.format).toBe('text')
    expect(result.data.metadata.charCount).toBeGreaterThan(400)
    expect(result.data.text).toContain('# Sample Document')
  })

  it('returns error for nonexistent file', async () => {
    const result = await importFile('/nonexistent/path/ghost.md')

    expect(result.type).toBe('error')
    if (result.type !== 'error') throw new Error('Expected error result')

    expect(result.error).toContain('Falha ao importar')
  })
})
