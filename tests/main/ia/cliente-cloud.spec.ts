import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IaConfiguracao, IaMensagem } from '../../../src/shared/types'

const mocks = vi.hoisted(() => {
  const googleModel = vi.fn((modelo: string) => ({ provider: 'gemini', modelo }))
  const openrouterModel = vi.fn((modelo: string) => ({ provider: 'openrouter', modelo }))

  return {
    queryOne: vi.fn(),
    generateText: vi.fn(),
    createGoogleGenerativeAI: vi.fn(() => googleModel),
    createOpenRouter: vi.fn(() => openrouterModel),
    googleModel,
    openrouterModel,
    isGeminiCloudApiEnabled: vi.fn(() => true),
  }
})

vi.mock('../../../src/main/db/query', () => ({ queryOne: mocks.queryOne }))
vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mocks.createGoogleGenerativeAI,
}))
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mocks.createOpenRouter,
}))
vi.mock('../../../src/main/config/app-config', () => ({
  isGeminiCloudApiEnabled: mocks.isGeminiCloudApiEnabled,
}))

import { iaEnviarMensagem, iaTestarConexao } from '../../../src/main/ia/cliente'

function config(overrides: Partial<IaConfiguracao> = {}): IaConfiguracao {
  return {
    id: 1,
    provider: 'gemini',
    api_key: 'gemini-fallback-token',
    modelo: 'gemini-3.5-flash',
    provider_configs_json: JSON.stringify({
      gemini: { token: 'gemini-provider-token', modelo: 'gemini-3.5-flash' },
    }),
    ativo: true,
    memoria_automatica: false,
    criado_em: new Date(0).toISOString(),
    atualizado_em: new Date(0).toISOString(),
    ...overrides,
  }
}

describe('cliente de IA cloud direto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isGeminiCloudApiEnabled.mockReturnValue(true)
    mocks.generateText.mockResolvedValue({ text: 'Resposta clínica revisável.' })
  })

  it('envia histórico e mensagem diretamente ao Gemini, sem tools, RAG ou roteamento', async () => {
    const historico: IaMensagem[] = [
      { id: 'u1', papel: 'usuario', conteudo: 'Contexto anterior', timestamp: '2026-01-01' },
      { id: 'a1', papel: 'assistente', conteudo: 'Resposta anterior', timestamp: '2026-01-01' },
      { id: 't1', papel: 'tool_result', conteudo: 'legado ignorado', timestamp: '2026-01-01' },
    ]
    mocks.queryOne.mockResolvedValue(config())

    await expect(iaEnviarMensagem(' Avalie o caso ', historico)).resolves.toEqual({
      resposta: 'Resposta clínica revisável.',
    })

    expect(mocks.createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'gemini-provider-token' })
    expect(mocks.googleModel).toHaveBeenCalledWith('gemini-3.5-flash')
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: { provider: 'gemini', modelo: 'gemini-3.5-flash' },
      system: expect.stringContaining('Antessala'),
      messages: [
        { role: 'user', content: 'Contexto anterior' },
        { role: 'assistant', content: 'Resposta anterior' },
        { role: 'user', content: 'Avalie o caso' },
      ],
    }))
    expect(mocks.generateText.mock.calls[0][0]).not.toHaveProperty('tools')
  })

  it('rejeita configuração legada do OpenRouter', async () => {
    mocks.queryOne.mockResolvedValue(config({
      provider: 'openrouter',
      api_key: 'fallback-openrouter',
      modelo: 'openai/gpt-oss-20b:free',
      provider_configs_json: JSON.stringify({
        openrouter: { token: 'openrouter-provider-token', modelo: 'anthropic/claude-sonnet-4' },
      }),
    }))

    await expect(iaEnviarMensagem('Olá')).rejects.toThrow('somente Gemini')
    expect(mocks.createOpenRouter).not.toHaveBeenCalled()
  })

  it('falha fechado sem configuração ativa antes de construir provider', async () => {
    mocks.queryOne.mockResolvedValue(config({ ativo: false }))

    await expect(iaEnviarMensagem('Olá')).rejects.toThrow('Assistente IA não configurado.')
    expect(mocks.createGoogleGenerativeAI).not.toHaveBeenCalled()
    expect(mocks.createOpenRouter).not.toHaveBeenCalled()
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it('testa explicitamente a conexão cloud sem persistir nem escolher rota', async () => {
    await expect(iaTestarConexao('openrouter', ' token ', ' openai/gpt-4.1 ')).rejects.toThrow(
      'somente Gemini',
    )
    expect(mocks.createOpenRouter).not.toHaveBeenCalled()
  })

  it('traduz limite do provedor sem vazar o erro bruto para a UI', async () => {
    mocks.queryOne.mockResolvedValue(config())
    mocks.generateText.mockRejectedValueOnce(new Error('HTTP 429 rate limit exceeded'))

    await expect(iaEnviarMensagem('Olá')).rejects.toThrow(
      'Limite de requisições excedido. Aguarde e tente novamente.',
    )
  })
})
