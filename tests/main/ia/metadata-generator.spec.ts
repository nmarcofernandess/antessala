import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  route: {
    ok: true,
    task: 'rag_metadata',
    label: 'Metadados do RAG',
    mode: 'explicit',
    provider: 'local',
    model: 'gemma-4-e2b-it-q4',
    reason: 'ready',
    message: 'ready',
    inherited: false,
    auto_selected: false,
  } as any,
  iaConfig: {
    id: 1,
    provider: 'gemini',
    api_key: 'gemini-token',
    modelo: 'gemini-old',
    provider_configs_json: JSON.stringify({
      openrouter: { token: 'or-token', modelo: 'openrouter-old' },
      gemini: { token: 'gemini-token', modelo: 'gemini-old' },
      local: { modelo: 'gemma-4-e2b-it-q4' },
    }),
    ativo: true,
    memoria_automatica: true,
    criado_em: '2026-06-14T00:00:00.000Z',
    atualizado_em: '2026-06-14T00:00:00.000Z',
  },
  localJson: '{"titulo":"Documento Local","quando_consultar":"Quando precisar do documento local"}',
  localChatResponse: 'Texto corrigido',
  generatedText: '{"titulo":"Documento Cloud","quando_consultar":"Quando a rota cloud for usada"}',
  buildModelFactory: vi.fn((config: any) => ({
    createModel: vi.fn((modelo: string) => ({ provider: config.provider, modelo })),
    modelo: JSON.parse(config.provider_configs_json)[config.provider].modelo,
  })),
  generateText: vi.fn(async () => ({ text: state.generatedText })),
  localLlmGenerateJson: vi.fn(async () => state.localJson),
  localLlmChat: vi.fn(async () => ({ resposta: state.localChatResponse, acoes: [] })),
}))

vi.mock('../../../src/main/ia/routing', () => ({
  assertIaRouteReady: vi.fn(async () => state.route),
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: vi.fn(async () => state.iaConfig),
}))

vi.mock('../../../src/main/ia/config', () => ({
  buildModelFactory: state.buildModelFactory,
}))

vi.mock('ai', () => ({
  generateText: state.generateText,
}))

vi.mock('../../../src/main/ia/local-llm', () => ({
  localLlmGenerateJson: state.localLlmGenerateJson,
  localLlmChat: state.localLlmChat,
  asLocalModelId: (value: string) => value,
}))

describe('parseMetadataSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts, trims and caps metadata JSON from a noisy response', async () => {
    const { parseMetadataSuggestion } = await import('../../../src/main/ia/metadata-generator')
    const longTitle = `  ${'Titulo '.repeat(30)}  `
    const longContext = `  ${'Quando consultar este documento '.repeat(20)}  `

    const parsed = parseMetadataSuggestion(`texto antes\n{"titulo":${JSON.stringify(longTitle)},"quando_consultar":${JSON.stringify(longContext)}}\ntexto depois`)

    expect(parsed.titulo.length).toBeLessThanOrEqual(120)
    expect(parsed.quando_consultar.length).toBeLessThanOrEqual(280)
    expect(parsed.titulo).toBe(parsed.titulo.trim())
    expect(parsed.quando_consultar).toBe(parsed.quando_consultar.trim())
  })

  it('rejects non-json and missing fields', async () => {
    const { parseMetadataSuggestion } = await import('../../../src/main/ia/metadata-generator')

    expect(() => parseMetadataSuggestion('sem json')).toThrow(/JSON/)
    expect(() => parseMetadataSuggestion('{"titulo":"Ok","quando_consultar":"  "}')).toThrow(/titulo e quando_consultar/)
  })
})

describe('generateRagMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.route = {
      ...state.route,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
    }
    state.localJson = '{"titulo":"Documento Local","quando_consultar":"Quando precisar do documento local"}'
    state.generatedText = '{"titulo":"Documento Cloud","quando_consultar":"Quando a rota cloud for usada"}'
  })

  it('uses the routed local model for JSON metadata', async () => {
    const { generateRagMetadata } = await import('../../../src/main/ia/metadata-generator')

    const result = await generateRagMetadata({ texto: 'conteudo', fileNameFallback: 'fallback.md' })

    expect(result).toMatchObject({
      titulo: 'Documento Local',
      quando_consultar: 'Quando precisar do documento local',
      route: expect.objectContaining({ provider: 'local', model: 'gemma-4-e2b-it-q4' }),
    })
    expect(state.localLlmGenerateJson).toHaveBeenCalledWith(expect.any(String), {
      modelId: 'gemma-4-e2b-it-q4',
      maxTokens: 512,
    })
  })

  it('builds cloud generation from the resolved route, not the active provider/model', async () => {
    state.route = {
      ...state.route,
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
    }
    const { generateRagMetadata } = await import('../../../src/main/ia/metadata-generator')

    const result = await generateRagMetadata({ texto: 'conteudo', fileNameFallback: 'fallback.md' })

    expect(result.titulo).toBe('Documento Cloud')
    expect(state.buildModelFactory).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      modelo: 'openai/gpt-oss-20b:free',
      api_key: 'or-token',
    }))
    const config = state.buildModelFactory.mock.calls[0][0]
    expect(JSON.parse(config.provider_configs_json).openrouter).toMatchObject({
      token: 'or-token',
      modelo: 'openai/gpt-oss-20b:free',
    })
    expect(state.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: { provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' },
    }))
  })

  it('uses saved cloud tokens even when the IA config row is inactive', async () => {
    state.route = {
      ...state.route,
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
    }
    state.iaConfig = {
      ...state.iaConfig,
      ativo: false,
    }
    const { generateRagMetadata } = await import('../../../src/main/ia/metadata-generator')

    await generateRagMetadata({ texto: 'conteudo', fileNameFallback: 'fallback.md' })

    expect(state.buildModelFactory).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      modelo: 'openai/gpt-oss-20b:free',
      api_key: 'or-token',
      ativo: false,
    }))
  })
})

describe('generateRagTextCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.route = {
      ...state.route,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
    }
  })

  it('uses local chat for text correction on local metadata route', async () => {
    const { generateRagTextCorrection } = await import('../../../src/main/ia/metadata-generator')

    const result = await generateRagTextCorrection('texto com erro')

    expect(result).toMatchObject({
      resultado: 'Texto corrigido',
      route: expect.objectContaining({ provider: 'local' }),
    })
    expect(state.localLlmChat).toHaveBeenCalledWith(
      expect.stringContaining('texto com erro'),
      [],
      expect.stringMatching(/^rag-text-correction-/),
      undefined,
      undefined,
      undefined,
      { modelId: 'gemma-4-e2b-it-q4' },
    )
  })
})
