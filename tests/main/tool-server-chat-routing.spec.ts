import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startToolServer, stopToolServer } from '../../src/main/tool-server'
import { TOOL_SERVER_AUTH_HEADER } from '../../src/shared/tool-server-url'

const AUTH_TOKEN = 'tool-server-test-token'

const mocks = vi.hoisted(() => ({
  iaEnviarMensagem: vi.fn(async (message: string) => ({
    resposta: `openrouter: ${message}`,
    acoes: [],
  })),
  getIaTaskReadiness: vi.fn(async () => ({
    ok: true,
    provider: 'openrouter',
    model: 'openai/gpt-oss-20b:free',
    reason: 'ready',
    message: 'OpenRouter pronto: openai/gpt-oss-20b:free.',
    task: 'cli_chat',
    label: 'Chat no Terminal',
    inherited: false,
    auto_selected: false,
  })),
  getIaChatReadiness: vi.fn(async () => ({
    ok: true,
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'IA local pronta.',
  })),
}))

vi.mock('../../src/main/ia/cliente', () => ({
  iaEnviarMensagem: mocks.iaEnviarMensagem,
}))

vi.mock('../../src/main/ia/readiness', () => ({
  getIaTaskReadiness: mocks.getIaTaskReadiness,
  getIaChatReadiness: mocks.getIaChatReadiness,
}))

vi.mock('../../src/main/db/query', () => ({
  queryOne: vi.fn(async () => ({
    provider: 'local',
    modelo: 'gemma-4-e2b-it-q4',
    ativo: true,
  })),
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

describe('tool server chat routing', () => {
  afterEach(() => {
    stopToolServer()
    baseUrl = ''
    vi.clearAllMocks()
  })

  it('preflights CLI chat through cli_chat readiness', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat/preflight`, {
      headers: { [TOOL_SERVER_AUTH_HEADER]: AUTH_TOKEN },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.readiness).toMatchObject({
      ok: true,
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
      task: 'cli_chat',
    })
    expect(mocks.getIaTaskReadiness).toHaveBeenCalledWith('cli_chat', { validateLocal: true })
  })

  it('passes cli_chat route task into chat generation', async () => {
    await startIsolatedToolServer()
    await waitForHealth()

    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TOOL_SERVER_AUTH_HEADER]: AUTH_TOKEN },
      body: JSON.stringify({
        message: 'oi terminal',
        history: [],
        context: { page: 'cli', route: '/cli' },
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.response).toBe('openrouter: oi terminal')
    expect(mocks.getIaTaskReadiness).toHaveBeenCalledWith('cli_chat', { validateLocal: true })
    expect(mocks.iaEnviarMensagem).toHaveBeenCalledWith(
      'oi terminal',
      [],
      { pagina: 'cli', rota: '/cli', store_snapshot: undefined },
      undefined,
      undefined,
      { task: 'cli_chat' },
    )
  })
})
