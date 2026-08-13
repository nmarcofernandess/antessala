import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startToolServer, stopToolServer } from '../../src/main/tool-server'
import { TOOL_SERVER_AUTH_HEADER } from '../../src/shared/tool-server-url'

vi.mock('../../src/main/ia/cliente', () => ({
  iaEnviarMensagem: vi.fn(async (message: string) => ({
    resposta: `eco: ${message}`,
    acoes: [],
  })),
}))

vi.mock('../../src/main/ia/readiness', () => ({
  getIaChatReadiness: vi.fn(async () => ({
    ok: true,
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'IA local pronta.',
  })),
  getIaTaskReadiness: vi.fn(async () => ({
    ok: true,
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'IA local pronta.',
    task: 'cli_chat',
    label: 'Chat no Terminal',
    inherited: true,
    auto_selected: false,
  })),
}))

vi.mock('../../src/main/db/query', () => ({
  queryOne: vi.fn(async () => ({
    provider: 'local',
    modelo: 'gemma-4-e2b-it-q4',
    ativo: true,
  })),
}))

let baseUrl = ''
const AUTH_TOKEN = 'tool-server-chat-test-token'

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

describe('tool server chat contract', () => {
  afterEach(() => {
    stopToolServer()
    baseUrl = ''
    delete process.env.FLOWKIT_TOOL_SERVER_TOKEN
    vi.clearAllMocks()
  })

  it('runs a non-streaming chat turn through the app IA client', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'oi',
        history: [],
        context: { page: 'cli', route: '/cli' },
        stream: false,
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.response).toBe('eco: oi')
    expect(body.actions).toEqual([])
  })

  it('rejects empty chat messages', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.message).toBe('Campo "message" é obrigatório.')
  })
})
