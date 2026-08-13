import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: DB layer
// ---------------------------------------------------------------------------
const queryAll = vi.fn()
const queryOne = vi.fn()
const execute = vi.fn()

vi.mock('../../../src/main/db/query', () => ({
  queryAll,
  queryOne,
  execute,
}))

// ---------------------------------------------------------------------------
// Mock: dynamic imports (enrichment, session-processor, config, ingest)
// ---------------------------------------------------------------------------
const enrichAllChunks = vi.fn()
const extractMemories = vi.fn()
const sanitizeTranscript = vi.fn(() => 'a'.repeat(200))
const ingestKnowledge = vi.fn()
const buildModelFactory = vi.fn(() => ({
  createModel: vi.fn(),
  modelo: 'test-model',
}))

vi.mock('../../../src/main/knowledge/enrichment', () => ({
  enrichAllChunks,
}))

vi.mock('../../../src/main/ia/session-processor', () => ({
  extractMemories,
  sanitizeTranscript,
}))

vi.mock('../../../src/main/ia/config', () => ({
  buildModelFactory,
}))

vi.mock('../../../src/main/knowledge/ingest', () => ({
  ingestKnowledge,
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
const { runCronPipeline } = await import('../../../src/main/cron/pipeline')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock config table: queryOne returns value for 'cron_last_run' key */
function mockConfigValue(value: string | null) {
  queryOne.mockImplementation((sql: string) => {
    if (sql.includes('FROM config')) {
      return value ? { value } : null
    }
    // IA config for enrichment/memory steps
    if (sql.includes('FROM configuracao_ia')) {
      return { provider: 'gemini', api_key: 'key', modelo: 'test' }
    }
    // Enrichment pending count
    if (sql.includes('COUNT')) {
      return { c: 0 }
    }
    return null
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cron Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryAll.mockResolvedValue([])
    execute.mockResolvedValue(undefined)
  })

  it('guard blocks if ran less than 24h ago', async () => {
    const recentRun = new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30min ago
    mockConfigValue(recentRun)

    const result = await runCronPipeline()

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('ran_recently')
    expect(result.steps).toHaveLength(0)
  })

  it('guard allows if ran more than 24h ago', async () => {
    const oldRun = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString() // 25h ago
    mockConfigValue(oldRun)

    const result = await runCronPipeline()

    expect(result.status).toBe('processed')
    expect(result.steps.some((s) => s.name === 'guard_24h')).toBe(true)
  })

  it('guard allows if never ran', async () => {
    mockConfigValue(null)

    const result = await runCronPipeline()

    expect(result.status).toBe('processed')
    expect(result.steps.some((s) => s.name === 'guard_24h')).toBe(true)
  })

  it('pipeline returns processed with step results', async () => {
    mockConfigValue(null)

    const result = await runCronPipeline()

    expect(result.status).toBe('processed')
    expect(result.duracao_ms).toBeGreaterThanOrEqual(0)
    // Should have guard + enrichment + memory + session + decay + log
    const names = result.steps.map((s) => s.name)
    expect(names).toContain('guard_24h')
    expect(names).toContain('lazy_decay')
    expect(names).toContain('log')
  })

  it('lazy decay marks old chunks as decayed', async () => {
    mockConfigValue(null)

    await runCronPipeline()

    // Find the execute call that does the decay UPDATE
    const decayCall = execute.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes("importance = 'decayed'"),
    )
    expect(decayCall).toBeDefined()
  })

  it('individual step failure does not stop pipeline', async () => {
    mockConfigValue(null)

    // Make enrichment throw
    queryOne.mockImplementation((sql: string) => {
      if (sql.includes('FROM config')) return null
      if (sql.includes('FROM configuracao_ia')) return { provider: 'gemini', api_key: 'key', modelo: 'test' }
      if (sql.includes('COUNT')) throw new Error('enrichment boom')
      return null
    })

    const result = await runCronPipeline()

    // Pipeline should still complete
    expect(result.status).toBe('processed')
    // Enrichment step should show error
    const enrichStep = result.steps.find((s) => s.name === 'enrichment')
    expect(enrichStep?.status).toBe('error')
    // Later steps should still run
    const names = result.steps.map((s) => s.name)
    expect(names).toContain('lazy_decay')
    expect(names).toContain('log')
  })
})
