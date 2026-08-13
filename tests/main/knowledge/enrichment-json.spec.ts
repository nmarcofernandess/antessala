import { describe, expect, it } from 'vitest'
import { extractJsonObject } from '../../../src/main/knowledge/enrichment'

describe('local enrichment JSON extraction', () => {
  it('extracts a fenced JSON object and removes trailing commas', () => {
    expect(extractJsonObject(`
\`\`\`json
{
  "chunks": [
    {
      "index": 0,
      "resumo": "Resumo",
      "tags": ["rag", "importacao",],
      "entidades": [],
      "relacoes": [],
    },
  ],
}
\`\`\`
texto extra
`)).toEqual({
      chunks: [{
        index: 0,
        resumo: 'Resumo',
        tags: ['rag', 'importacao'],
        entidades: [],
        relacoes: [],
      }],
    })
  })

  it('keeps invalid local JSON as an explicit error', () => {
    expect(() => extractJsonObject('{"chunks":[{"index":0 "resumo":"sem virgula"}]}'))
      .toThrow(/Modelo local nao retornou JSON valido/)
  })
})
