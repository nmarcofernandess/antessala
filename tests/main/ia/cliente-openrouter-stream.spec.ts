import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IaConfiguracao, IaStreamEvent } from '../../../src/shared/types'

const mocks = vi.hoisted(() => {
  const sentEvents: Array<{ channel: string; data: IaStreamEvent }> = []
  const openrouterModel = vi.fn((modelo: string) => ({ provider: 'openrouter', modelo }))

  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    stepCountIs: vi.fn((count: number) => ({ type: 'step-count', count })),
    wrapLanguageModel: vi.fn(({ model }: { model: unknown }) => model),
    openrouterModel,
    createOpenRouter: vi.fn(() => openrouterModel),
    sentEvents,
    getAllWindows: vi.fn(() => [
      {
        webContents: {
          send: (channel: string, data: IaStreamEvent) => {
            sentEvents.push({ channel, data })
          },
        },
      },
    ]),
    queryOne: vi.fn(),
  }
})

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  streamText: mocks.streamText,
  stepCountIs: mocks.stepCountIs,
  wrapLanguageModel: mocks.wrapLanguageModel,
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mocks.createOpenRouter,
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: mocks.getAllWindows,
  },
  default: {
    BrowserWindow: {
      getAllWindows: mocks.getAllWindows,
    },
  },
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: mocks.queryOne,
}))

vi.mock('../../../src/main/ia/routing', () => ({
  assertIaRouteReady: vi.fn(async () => ({
    ok: true,
    task: 'chat_ui',
    label: 'Chat do app',
    mode: 'explicit',
    provider: 'openrouter',
    model: 'openai/gpt-oss-20b:free',
    reason: 'ready',
    message: 'OpenRouter pronto.',
    inherited: false,
    auto_selected: false,
  })),
}))

vi.mock('../../../src/main/ia/discovery', () => ({
  buildContextBundle: vi.fn(async (contexto) => contexto
    ? {
        rota: contexto.rota,
        global: {
          knowledge_sources: 1,
          knowledge_chunks: 2,
          knowledge_entities: 0,
          memorias: 0,
        },
        knowledge_catalogo: {
          total_fontes: 1,
          total_chunks: 2,
          titulos_top: ['Agenda DietFlow'],
        },
        dica_pagina: '',
      }
    : null),
  renderContextBriefing: vi.fn(() => 'briefing'),
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

import { __iaClienteTestables, iaEnviarMensagemStream } from '../../../src/main/ia/cliente'

const openrouterConfig: IaConfiguracao = {
  id: 1,
  provider: 'openrouter',
  api_key: '',
  modelo: 'openai/gpt-oss-20b:free',
  provider_configs_json: JSON.stringify({
    openrouter: {
      token: 'test-openrouter-token',
      modelo: 'openai/gpt-oss-20b:free',
    },
  }),
  ativo: true,
  memoria_automatica: true,
  criado_em: new Date(0).toISOString(),
  atualizado_em: new Date(0).toISOString(),
}

describe('iaEnviarMensagemStream — OpenRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sentEvents.length = 0
    process.env.FLOWKIT_AI_DEVTOOLS = '0'
    __iaClienteTestables.setStreamEventSink((event) => {
      mocks.sentEvents.push({ channel: 'ia:stream', data: event })
    })

    mocks.queryOne.mockResolvedValue(openrouterConfig)
    mocks.generateText.mockResolvedValue({
      text: 'Resposta ok sobre agenda.',
      steps: [],
      response: { messages: [] },
    })
    mocks.streamText.mockImplementation(() => {
      throw new Error('streamText should not be used for OpenRouter stream bridge')
    })
  })

  afterEach(() => {
    __iaClienteTestables.setStreamEventSink(null)
  })

  it('bridges UI streaming through non-streaming generateText for OpenRouter', async () => {
    const result = await iaEnviarMensagemStream(
      'Em termos de negocio, quais insights temos para agenda?',
      [],
      'stream-openrouter-1',
      { rota: '/ia', pagina: 'ia' },
    )

    expect(result).toEqual({ resposta: 'Resposta ok sobre agenda.', acoes: [] })
    expect(mocks.createOpenRouter).toHaveBeenCalledWith({ apiKey: 'test-openrouter-token' })
    expect(mocks.openrouterModel).toHaveBeenCalledWith('openai/gpt-oss-20b:free')
    expect(mocks.generateText).toHaveBeenCalledTimes(1)
    expect(mocks.streamText).not.toHaveBeenCalled()

    const events = mocks.sentEvents.map(({ channel, data }) => ({ channel, type: data.type, data }))

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'ia:stream', type: 'context-meta' }),
      expect.objectContaining({ channel: 'ia:stream', type: 'start-step' }),
      expect.objectContaining({
        channel: 'ia:stream',
        type: 'text-delta',
        data: expect.objectContaining({ delta: 'Resposta ok sobre agenda.' }),
      }),
      expect.objectContaining({
        channel: 'ia:stream',
        type: 'finish',
        data: expect.objectContaining({
          resposta: 'Resposta ok sobre agenda.',
          acoes: [],
        }),
      }),
    ]))
  })

  it('keeps AI DevTools disabled unless explicitly enabled', () => {
    delete process.env.FLOWKIT_AI_DEVTOOLS
    expect(__iaClienteTestables.shouldEnableAiDevTools()).toBe(false)

    process.env.FLOWKIT_AI_DEVTOOLS = '1'
    expect(__iaClienteTestables.shouldEnableAiDevTools()).toBe(true)
  })
})
