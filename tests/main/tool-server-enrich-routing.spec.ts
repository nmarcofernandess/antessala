import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startToolServer, stopToolServer } from '../../src/main/tool-server'
import { TOOL_SERVER_AUTH_HEADER } from '../../src/shared/tool-server-url'

const AUTH_TOKEN = 'tool-server-test-token'

const mocks = vi.hoisted(() => ({
  getKnowledgeEnrichmentConfig: vi.fn(async () => ({
    auto_enrich_after_import: false,
    provider: 'auto' as const,
    modelo: 'auto',
    force_all_default: false,
  })),
  buildKnowledgeEnrichmentModel: vi.fn(),
  enrichAllChunksWithModel: vi.fn(),
  getIaChatReadiness: vi.fn(async () => ({
    ok: true,
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'IA local pronta.',
  })),
}))

vi.mock('../../src/main/knowledge/enrichment-config', () => ({
  getKnowledgeEnrichmentConfig: mocks.getKnowledgeEnrichmentConfig,
  buildKnowledgeEnrichmentModel: mocks.buildKnowledgeEnrichmentModel,
}))

vi.mock('../../src/main/knowledge/enrichment', () => ({
  enrichAllChunksWithModel: mocks.enrichAllChunksWithModel,
}))

vi.mock('../../src/main/ia/readiness', () => ({
  getIaChatReadiness: mocks.getIaChatReadiness,
  getIaTaskReadiness: vi.fn(async () => ({ ok: true, provider: 'local', model: 'gemma-4-e2b-it-q4', reason: 'ready', message: 'ok' })),
}))

vi.mock('../../src/main/db/query', () => ({
  queryOne: vi.fn(async () => ({ provider: 'local', modelo: 'gemma-4-e2b-it-q4', ativo: true })),
}))

let baseUrl = ''

async function startIsolatedToolServer(): Promise<void> {
  process.env.FLOWKIT_TOOL_SERVER_TOKEN = AUTH_TOKEN
  const server = startToolServer({ port: 0 })
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
}

async function waitForHealth(): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 3000) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  throw new Error('tool server did not start')
}

async function postEnrich(body: Record<string, unknown>): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/rag/groups/1/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [TOOL_SERVER_AUTH_HEADER]: AUTH_TOKEN },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

describe('tool server enrich endpoint', () => {
  afterEach(() => {
    stopToolServer()
    baseUrl = ''
    vi.clearAllMocks()
  })

  it('returns ok when every enrichment batch succeeds', async () => {
    mocks.buildKnowledgeEnrichmentModel.mockResolvedValue({ provider: 'local', modelo: 'gemma-4-e2b-it-q4' })
    mocks.enrichAllChunksWithModel.mockResolvedValue({ batches_failed: 0, chunks_enriquecidos: 5 })
    await startIsolatedToolServer()
    await waitForHealth()

    const { status, body } = await postEnrich({})

    expect(status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.result).toMatchObject({ chunks_enriquecidos: 5 })
  })

  it('returns partial when some batches fail but chunks were enriched', async () => {
    mocks.buildKnowledgeEnrichmentModel.mockResolvedValue({ provider: 'local', modelo: 'gemma-4-e2b-it-q4' })
    mocks.enrichAllChunksWithModel.mockResolvedValue({ batches_failed: 1, chunks_enriquecidos: 3 })
    await startIsolatedToolServer()
    await waitForHealth()

    const { status, body } = await postEnrich({})

    expect(status).toBe(200)
    expect(body.status).toBe('partial')
  })

  it('surfaces the route error (400) instead of a silent success when no model is ready', async () => {
    mocks.buildKnowledgeEnrichmentModel.mockRejectedValue(new Error('O modelo "Gemma 4 E2B IT" ainda não foi baixado.'))
    await startIsolatedToolServer()
    await waitForHealth()

    const { status, body } = await postEnrich({})

    expect(status).toBe(400)
    expect(body.status).toBe('error')
    expect(body.message).toMatch(/baixad/i)
    expect(mocks.enrichAllChunksWithModel).not.toHaveBeenCalled()
  })
})
