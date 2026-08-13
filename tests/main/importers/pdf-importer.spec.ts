import { describe, it, expect } from 'vitest'
import { importPdf } from '../../../src/main/importers/pdf-importer'

describe('importPdf', () => {
  it('exports importPdf as an async function', () => {
    expect(typeof importPdf).toBe('function')
    // Returns a Promise (async function)
    const result = importPdf('/non-existent.pdf').catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('rejects with an error for a non-existent file', async () => {
    await expect(importPdf('/non-existent-file.pdf')).rejects.toThrow()
  })
})
