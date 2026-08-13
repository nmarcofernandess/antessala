import { request } from 'node:http'
import { access, mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IA_TOOLS } from '../../src/main/ia/tools'
import { startToolServer, stopToolServer } from '../../src/main/tool-server'
import { TOOL_SERVER_AUTH_HEADER } from '../../src/shared/tool-server-url'

let baseUrl = ''
let toolPort = 0
const AUTH_TOKEN = 'tool-server-test-token'

const readinessState = vi.hoisted(() => ({
  readiness: {
    ok: false,
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'validate_local_model',
    message: 'Modelo local baixado, mas ainda não foi validado.',
    action: 'Clique em Testar conexão antes de usar chat ou CLI.',
  },
}))

vi.mock('../../src/main/ia/readiness', () => ({
  getIaChatReadiness: vi.fn(async () => readinessState.readiness),
  getIaTaskReadiness: vi.fn(async () => readinessState.readiness),
}))

vi.mock('../../src/main/db/query', () => ({
  queryOne: vi.fn(async () => ({
    provider: 'local',
    modelo: 'gemma-4-e2b-it-q4',
    ativo: true,
  })),
  execute: vi.fn(async () => undefined),
}))

vi.mock('../../src/main/knowledge/bulk-import', () => ({
  startBulkRagImport: vi.fn((input: { path: string; group_name: string }) => ({
    id: 'job_bulk_test',
    type: 'bulk_rag_import',
    label: `Importar RAG: ${input.group_name}`,
    status: 'pending',
    progress: { total: 0, done: 0 },
    metadata: input,
    error_message: null,
    created_at: '2026-06-12T00:00:00.000Z',
    updated_at: '2026-06-12T00:00:00.000Z',
    finished_at: null,
  })),
  pauseBulkRagImportJob: vi.fn(async (id: number) => ({
    live_job_id: 'job_bulk_test',
    job: { id, status: 'paused' },
  })),
  resumeBulkRagImportJob: vi.fn(async (id: number) => ({
    live_job_id: 'job_bulk_test',
    job: { id, status: 'importing' },
  })),
  cancelBulkRagImportJob: vi.fn(async (id: number) => ({
    live_job_id: 'job_bulk_test',
    job: { id, status: 'cancelled' },
  })),
}))

vi.mock('../../src/main/knowledge/bulk-persistence', () => ({
  listKnowledgeImportJobs: vi.fn(async () => ([{
    id: 10,
    group_id: 5,
    root_path: '/tmp/docs',
    recursive: true,
    status: 'done',
    total_files: 2,
    processed_files: 2,
    failed_files: 0,
    total_bytes: 100,
    processed_bytes: 100,
    chunks_created: 4,
    error_message: null,
    started_at: '2026-06-12T00:00:00.000Z',
    finished_at: '2026-06-12T00:00:01.000Z',
  }])),
  getKnowledgeImportJob: vi.fn(async (id: number) => id === 10 ? {
    id: 10,
    group_id: 5,
    root_path: '/tmp/docs',
    recursive: true,
    status: 'done',
    total_files: 2,
    processed_files: 2,
    failed_files: 0,
    total_bytes: 100,
    processed_bytes: 100,
    chunks_created: 4,
    error_message: null,
    started_at: '2026-06-12T00:00:00.000Z',
    finished_at: '2026-06-12T00:00:01.000Z',
  } : null),
  listKnowledgeImportFiles: vi.fn(async () => ([{
    id: 1,
    job_id: 10,
    source_id: 7,
    path: '/tmp/docs/a.md',
    relative_path: 'a.md',
    size_bytes: 50,
    mtime_ms: 0,
    sha256: null,
    mime_type: 'text/markdown',
    status: 'done',
    error_message: null,
  }])),
  updateKnowledgeImportJob: vi.fn(async () => undefined),
}))

vi.mock('../../src/main/terminal/config', () => ({
  getTerminalHarnessConfig: vi.fn(async () => ({
    default_cwd: process.cwd(),
    max_timeout_ms: 30000,
    max_output_chars: 20000,
  })),
}))

async function startIsolatedToolServer(): Promise<void> {
  process.env.FLOWKIT_TOOL_SERVER_TOKEN = AUTH_TOKEN
  const server = startToolServer({ port: 0 })
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address() as AddressInfo
  toolPort = address.port
  baseUrl = `http://127.0.0.1:${toolPort}`
}

function withAuth(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      [TOOL_SERVER_AUTH_HEADER]: AUTH_TOKEN,
      ...(init.headers as Record<string, string> | undefined),
    },
  }
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

async function requestWithHost(pathname: string, host: string): Promise<{ status: number, body: any }> {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port: toolPort,
      path: pathname,
      method: 'GET',
      headers: { Host: host },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

describe('tool server core contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readinessState.readiness = {
      ok: false,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'validate_local_model',
      message: 'Modelo local baixado, mas ainda não foi validado.',
      action: 'Clique em Testar conexão antes de usar chat ou CLI.',
    }
  })

  afterEach(() => {
    stopToolServer()
    baseUrl = ''
    toolPort = 0
    delete process.env.FLOWKIT_TOOL_SERVER_TOKEN
  })

  it('returns expanded health', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/health`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('FlowKit')
    expect(body.version).toBe('?')
    expect(body.tools).toBe(IA_TOOLS.length)
    expect(body.db.connected).toBe(true)
    expect(body.ia).toEqual(expect.objectContaining({
      ativo: expect.any(Boolean),
    }))
    expect(body.ia).toHaveProperty('provider')
    expect(body.ia).toHaveProperty('modelo')
    expect(body.ia).toHaveProperty('local_model')
    expect(body.ia.readiness).toMatchObject({
      ok: false,
      reason: 'validate_local_model',
    })
  })

  it('exposes chat preflight readiness before starting CLI chat', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat/preflight`, withAuth())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.status).toBe('error')
    expect(body.readiness).toMatchObject({
      ok: false,
      provider: 'local',
      reason: 'validate_local_model',
    })
    expect(body.message).toContain('não foi validado')
  })

  it('exposes AI terminal readiness with command and resolved runtime', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/terminal/ai-status?cwd=${encodeURIComponent('/tmp/Flow Kit')}`, withAuth())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.readiness).toMatchObject({
      ok: false,
      code: 'modelNeedsValidation',
      command: expect.stringContaining('npm --prefix'),
      cwd: '/tmp/Flow Kit',
      runtime: {
        provider: 'local',
        model: 'gemma-4-e2b-it-q4',
      },
    })
  })

  it('rejects chat requests before invoking the model when readiness fails', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'e ai mano',
        history: [],
        context: { page: 'cli', route: '/cli' },
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.status).toBe('error')
    expect(body.message).toContain('Testar conexão')
    expect(body.readiness.reason).toBe('validate_local_model')
  })

  it('rejects unknown tools with a direct message', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/tool`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'nao_existe', args: {} }),
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.status).toBe('error')
    expect(body.message).toBe(`Tool 'nao_existe' nao existe`)
  })

  it('lists and cancels jobs', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const jobsRes = await fetch(`${baseUrl}/jobs`, withAuth())
    const jobsBody = await jobsRes.json()

    expect(jobsRes.status).toBe(200)
    expect(jobsBody.jobs).toEqual([])

    const missingRes = await fetch(`${baseUrl}/jobs/job_missing/cancel`, withAuth({ method: 'POST' }))
    const missingBody = await missingRes.json()

    expect(missingRes.status).toBe(404)
    expect(missingBody.message).toBe('Job "job_missing" nao encontrado.')
  })

  it('starts bulk RAG imports through the local HTTP API', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/rag/import`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/tmp/docs',
        group_name: 'Docs',
        auto_enrich: false,
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.job).toEqual(expect.objectContaining({
      id: 'job_bulk_test',
      type: 'bulk_rag_import',
    }))
  })

  it('validates bulk RAG import payloads', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/rag/import`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_name: 'Docs' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.message).toBe('Campo "path" é obrigatório.')
  })

  it('lists persistent bulk RAG jobs through the local HTTP API', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/rag/jobs`, withAuth())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].id).toBe(10)
  })

  it('reads persistent bulk RAG job files through the local HTTP API', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/rag/jobs/10`, withAuth())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.job.id).toBe(10)
    expect(body.files[0].relative_path).toBe('a.md')
  })

  it('routes persistent bulk RAG job controls to the live import controller', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const cancelRes = await fetch(`${baseUrl}/rag/jobs/10/cancel`, withAuth({ method: 'POST' }))
    const cancelBody = await cancelRes.json()

    expect(cancelRes.status).toBe(200)
    expect(cancelBody.status).toBe('ok')
    expect(cancelBody.live_job_id).toBe('job_bulk_test')
    expect(cancelBody.job.status).toBe('cancelled')
  })

  it('returns non-200 for invalid persistent bulk RAG job controls', async () => {
    const bulkImport = await import('../../src/main/knowledge/bulk-import')
    vi.mocked(bulkImport.cancelBulkRagImportJob).mockRejectedValueOnce(Object.assign(
      new Error('RAG job "999" nao encontrado.'),
      { statusCode: 404 },
    ))

    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/rag/jobs/999/cancel`, withAuth({ method: 'POST' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.status).toBe('error')
    expect(body.message).toContain('nao encontrado')
  })

  it('runs terminal commands through the local HTTP API', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/terminal/exec`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'printf terminal', wait: true }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.result.stdout).toBe('terminal')
  })

  it('validates terminal command payloads', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/terminal/exec`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '   ' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.message).toBe('Campo "command" é obrigatório.')
  })

  it('rejects sensitive requests without the local token', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/terminal/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'printf should-not-run', wait: true }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.message).toBe('Token local do FlowKit ausente ou invalido.')
  })

  it('rejects browser-origin terminal requests before side effects', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'flowkit-hostile-browser-'))
    const markerPath = path.join(tmpDir, 'owned.txt')

    try {
      const res = await fetch(`${baseUrl}/terminal/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Origin: 'https://evil.example.com',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: JSON.stringify({
          command: `printf owned > ${JSON.stringify(markerPath)}`,
          wait: true,
        }),
      })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.message).toContain('navegador externo')
      await expect(access(markerPath)).rejects.toThrow()
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects non-loopback Host headers', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const { status, body } = await requestWithHost('/health', 'evil.example.com')

    expect(status).toBe(403)
    expect(body.message).toBe('Acesso permitido apenas via loopback local.')
  })
})
