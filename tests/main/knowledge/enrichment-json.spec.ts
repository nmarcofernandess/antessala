import { describe, expect, it } from 'vitest'
import { extractJsonObject } from '../../../src/main/knowledge/enrichment'

describe('enrichment JSON extraction', () => {
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

  it('keeps invalid model JSON as an explicit error', () => {
    expect(() => extractJsonObject('{"chunks":[{"index":0 "resumo":"sem virgula"}]}'))
      .toThrow(/Modelo nao retornou JSON valido/)
  })
})
