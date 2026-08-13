import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryAll = vi.fn(async () => [])
const execute = vi.fn(async () => ({ changes: 0 }))
const queryOne = vi.fn(async () => undefined)
const generateQueryEmbedding = vi.fn(async () => Array.from({ length: 768 }, () => 0.01))

vi.mock('../../../src/main/db/query', () => ({
  queryAll,
  execute,
  queryOne,
}))

vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generateQueryEmbedding,
}))

describe('searchKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not penalize FTS-only chunks when imported content has no embeddings', async () => {
    const { searchKnowledge } = await import('../../../src/main/knowledge/search')

    await searchKnowledge('templateUsedId duplicateID', { limite: 5 })

    const hybridSql = String(queryAll.mock.calls[0]?.[0] ?? '')
    expect(hybridSql).toContain('WHEN v.id IS NULL AND f.id IS NOT NULL')
    expect(hybridSql).toContain('0.8 + COALESCE(f.fts_score, 0)')
  })
})
