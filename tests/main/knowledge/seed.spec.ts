import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track ingest calls
const ingestCalls: Array<{ titulo: string; importance: string }> = []
const graphSeedCalls: Array<{ entities: number; relations: number }> = []

// Mock PGlite
vi.mock('../../../src/main/db/pglite', () => ({
  getDb: vi.fn(() => ({
    query: vi.fn(async () => ({ rows: [], affectedRows: 0 })),
  })),
}))

// Mock DB query layer
vi.mock('../../../src/main/db/query', () => {
  let idCounter = 0
  return {
    insertReturningId: vi.fn(async () => ++idCounter),
    execute: vi.fn(async () => ({ changes: 0 })),
    queryAll: vi.fn(async (_sql: string, sourceId?: number) => {
      const countBySourceId = new Map<number, number>([
        [1, 4],
        [2, 3],
        [3, 3],
      ])
      const count = countBySourceId.get(Number(sourceId)) ?? 0
      return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        conteudo: `chunk ${index}`,
      }))
    }),
    queryOne: vi.fn(async () => ({ c: 0 })), // knowledge_sources count = 0 → triggers seed
  }
})

// Mock embeddings (no ONNX model in test)
vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generatePassageEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
  generatePassageEmbedding: vi.fn(async () => null),
}))

// Mock ingest to track calls
vi.mock('../../../src/main/knowledge/ingest', () => ({
  ingestKnowledge: vi.fn(async (titulo: string, _content: string, importance: string) => {
    ingestCalls.push({ titulo, importance })
    return { source_id: ingestCalls.length, chunks_count: 3, entities_count: 0 }
  }),
}))

// Mock graph import
vi.mock('../../../src/main/knowledge/graph', () => ({
  importGraphSeed: vi.fn(async (seed: { entities: any[]; relations: any[] }) => {
    graphSeedCalls.push({ entities: seed.entities.length, relations: seed.relations.length })
    return { entities_count: seed.entities.length, relations_count: seed.relations.length }
  }),
}))

describe('seed — 3-phase knowledge bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ingestCalls.length = 0
    graphSeedCalls.length = 0
  })

  it('Phase 1: ingests 3 system docs via ingestKnowledge', async () => {
    const { seedData } = await import('../../../src/main/db/seed')
    await seedData()

    expect(ingestCalls).toHaveLength(3)
    expect(ingestCalls[0].titulo).toBe('sistema — CLAUDE')
    expect(ingestCalls[1].titulo).toBe('sistema — ARCHITECTURE')
    expect(ingestCalls[2].titulo).toBe('sistema — PLUG-AND-PLAY')
    expect(ingestCalls.every(c => c.importance === 'high')).toBe(true)
  })

  it('Phase 3: imports graph seed with entities and relations', async () => {
    const { seedData } = await import('../../../src/main/db/seed')
    await seedData()

    expect(graphSeedCalls).toHaveLength(1)
    expect(graphSeedCalls[0].entities).toBeGreaterThan(0)
    expect(graphSeedCalls[0].relations).toBeGreaterThan(0)
  })

  it('is idempotent: skips if knowledge_sources already has sistema docs', async () => {
    // Override queryOne to return count > 0
    const { queryOne } = await import('../../../src/main/db/query')
    ;(queryOne as any).mockResolvedValueOnce({ c: 3 })

    const { seedData } = await import('../../../src/main/db/seed')
    await seedData()

    // Should NOT have ingested anything
    expect(ingestCalls).toHaveLength(0)
    expect(graphSeedCalls).toHaveLength(0)
  })
})
