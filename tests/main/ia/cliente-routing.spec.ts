import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiRouteResolution } from '../../../src/shared/ia-routing-contract'
import type { IaConfiguracao } from '../../../src/shared/types'

const mocks = vi.hoisted(() => {
  const localLlmChat = vi.fn(async () => ({ resposta: 'local ok', acoes: [] }))
  const googleModel = vi.fn((modelo: string) => ({ provider: 'gemini', modelo }))
  const openrouterModel = vi.fn((modelo: string) => ({ provider: 'openrouter', modelo }))
  const route: AiRouteResolution = {
    ok: true,
    task: 'chat_ui',
    label: 'Chat do app',
    mode: 'explicit',
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'IA local pronta.',
    inherited: false,
    auto_selected: false,
  }

  return {
    route,
    queryOne: vi.fn(),
    assertIaRouteReady: vi.fn(async () => route),
    localLlmChat,
    createGoogleGenerativeAI: vi.fn(() => googleModel),
    createOpenRouter: vi.fn(() => openrouterModel),
    googleModel,
    openrouterModel,
  }
})

vi.mock('../../../src/main/db/query', () => ({
  queryOne: mocks.queryOne,
}))

vi.mock('../../../src/main/ia/routing', () => ({
  assertIaRouteReady: mocks.assertIaRouteReady,
}))

vi.mock('../../../src/main/ia/local-llm', () => ({
  localLlmChat: mocks.localLlmChat,
  asLocalModelId: (value: string) => value,
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mocks.createGoogleGenerativeAI,
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mocks.createOpenRouter,
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  stepCountIs: vi.fn((count: number) => ({ type: 'step-count', count })),
  wrapLanguageModel: vi.fn(({ model }: { model: unknown }) => model),
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  default: { BrowserWindow: { getAllWindows: vi.fn(() => []) } },
}))

vi.mock('../../../src/main/ia/discovery', () => ({
  buildContextBundle: vi.fn(async () => null),
  renderContextBriefing: vi.fn(() => ''),
  buildContextBriefing: vi.fn(async () => ''),
}))

vi.mock('../../../src/main/ia/session-processor', () => ({
  maybeCompact: vi.fn(async () => null),
}))

vi.mock('../../../src/main/ia/tools', () => ({
  getVercelAiFamilyTools: vi.fn(() => ({})),
}))

vi.mock('../../../src/main/config/app-config', () => ({
  isGeminiCloudApiEnabled: vi.fn(() => true),
}))

function activeGeminiConfig(): IaConfiguracao {
  return {
    id: 1,
    provider: 'gemini',
    api_key: 'gemini-active-token',
    modelo: 'gemini-3.5-flash',
    provider_configs_json: JSON.stringify({
      gemini: { token: 'gemini-provider-token', modelo: 'gemini-3.5-flash' },
      local: { modelo: 'gemma-4-e2b-it-q4' },
      openrouter: { token: 'or-token', modelo: 'openai/gpt-oss-20b:free' },
    }),
    ativo: true,
    memoria_automatica: true,
    criado_em: new Date(0).toISOString(),
    atualizado_em: new Date(0).toISOString(),
  }
}

describe('ia cliente route-backed runtime selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryOne.mockResolvedValue(activeGeminiConfig())
    mocks.route = {
      ok: true,
      task: 'chat_ui',
      label: 'Chat do app',
      mode: 'explicit',
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'ready',
      message: 'IA local pronta.',
      inherited: false,
      auto_selected: false,
    }
  })

  it('uses the resolved local route even when active config is Gemini', async () => {
    const { iaEnviarMensagem } = await import('../../../src/main/ia/cliente')

    const result = await iaEnviarMensagem('oi', [], undefined, undefined, undefined, { task: 'chat_ui' })

    expect(result).toEqual({ resposta: 'local ok', acoes: [] })
    expect(mocks.assertIaRouteReady).toHaveBeenCalledWith('chat_ui', { validateLocal: true })
    expect(mocks.localLlmChat).toHaveBeenCalledWith(
      'oi',
      [],
      'non-stream',
      undefined,
      undefined,
      undefined,
      { modelId: 'gemma-4-e2b-it-q4' },
    )
    expect(mocks.createGoogleGenerativeAI).not.toHaveBeenCalled()
    expect(mocks.createOpenRouter).not.toHaveBeenCalled()
  })

  it('uses a ready local route even when no legacy IA config row exists', async () => {
    mocks.queryOne.mockResolvedValue(null)
    const { iaEnviarMensagemStream } = await import('../../../src/main/ia/cliente')

    const result = await iaEnviarMensagemStream('oi', [], 'stream-local', undefined, undefined, undefined, { task: 'chat_ui' })

    expect(result).toEqual({ resposta: 'local ok', acoes: [] })
    expect(mocks.localLlmChat).toHaveBeenCalledWith(
      'oi',
      [],
      'stream-local',
      undefined,
      undefined,
      undefined,
      { modelId: 'gemma-4-e2b-it-q4' },
    )
    expect(mocks.createGoogleGenerativeAI).not.toHaveBeenCalled()
    expect(mocks.createOpenRouter).not.toHaveBeenCalled()
  })

  it('uses the resolved cloud route (with its token) even when the active config row is local', async () => {
    // Active config is local, but the route resolves to OpenRouter — generation must follow the route.
    mocks.queryOne.mockResolvedValue({
      ...activeGeminiConfig(),
      provider: 'local',
      api_key: '',
      modelo: 'gemma-4-e2b-it-q4',
    })
    mocks.assertIaRouteReady.mockResolvedValueOnce({
      ok: true,
      task: 'cli_chat',
      label: 'Chat no Terminal',
      mode: 'explicit',
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
      reason: 'ready',
      message: 'OpenRouter pronto.',
      inherited: false,
      auto_selected: false,
    })
    const { iaEnviarMensagem } = await import('../../../src/main/ia/cliente')

    // generateText is mocked to return undefined, so generation throws AFTER the provider is built —
    // which is enough to prove the route's provider/token won over the local active config.
    await expect(
      iaEnviarMensagem('oi', [], undefined, undefined, undefined, { task: 'cli_chat' }),
    ).rejects.toThrow()

    expect(mocks.createOpenRouter).toHaveBeenCalledWith({ apiKey: 'or-token' })
    expect(mocks.localLlmChat).not.toHaveBeenCalled()
    expect(mocks.createGoogleGenerativeAI).not.toHaveBeenCalled()
  })
})
