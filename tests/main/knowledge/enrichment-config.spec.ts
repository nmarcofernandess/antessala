import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbState = vi.hoisted(() => ({
  configValues: {} as Record<string, unknown>,
  defaultIaConfig: {
    id: 1,
    provider: 'openrouter',
    api_key: '',
    modelo: 'openai/gpt-oss-20b:free',
    provider_configs_json: JSON.stringify({
      openrouter: { token: 'sk-or-test', modelo: 'openai/gpt-oss-20b:free' },
      gemini: { token: '', modelo: 'gemini-3.5-flash' },
      local: { modelo: 'gemma-4-e2b-it-q4' },
    }),
    ativo: true,
    memoria_automatica: true,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  iaConfig: {} as any,
  localDownloaded: true,
  localUsable: true,
  validateCalls: 0,
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: vi.fn(async (sql: string, key?: string) => {
    if (sql.includes('FROM configuracao_ia')) return dbState.iaConfig
    if (sql.includes('FROM config')) {
      return dbState.configValues[key ?? ''] === undefined ? undefined : { value: dbState.configValues[key ?? ''] }
    }
    return undefined
  }),
  execute: vi.fn(async (_sql: string, _key: string, value: string) => {
    dbState.configValues[_key] = JSON.parse(value)
    return { changes: 1 }
  }),
}))

vi.mock('../../../src/main/ia/local-llm', () => ({
  LOCAL_MODELS: {
    'gemma-4-e2b-it-q4': {
      label: 'Gemma 4 E2B IT',
      size_bytes: 3_110_000_000,
      filename: 'gemma-4-E2B-it-Q4_K_M.gguf',
      url: 'https://example.test/model.gguf',
      ram_minima_gb: 4,
      descricao: 'test',
    },
  },
  getLocalStatus: vi.fn(() => ({
    modelos: {
      'gemma-4-e2b-it-q4': {
        baixado: dbState.localDownloaded,
        usable: dbState.localDownloaded && dbState.localUsable,
        requires_validation: dbState.localDownloaded && !dbState.localUsable,
        tamanho_bytes: 3_110_000_000,
      },
    },
    modelo_carregado: false,
  })),
  validateLocalModel: vi.fn(async () => {
    dbState.validateCalls++
    if (!dbState.localDownloaded) throw new Error('Modelo local nao baixado.')
    dbState.localUsable = true
    return { usable: true }
  }),
}))

vi.mock('../../../src/main/knowledge/enrichment', () => ({
  createLocalEnrichmentModel: vi.fn((modelo: string) => ({ provider: 'local', modelo, generate: vi.fn() })),
  createAiSdkEnrichmentModel: vi.fn((_createModel: unknown, modelo: string, provider: string) => ({ provider, modelo, generate: vi.fn() })),
}))

vi.mock('../../../src/main/ia/config', async () => {
  const actual = await vi.importActual<typeof import('../../../src/main/ia/config')>('../../../src/main/ia/config')
  return {
    ...actual,
    buildModelFactory: vi.fn((config: any) => ({
      createModel: vi.fn(),
      modelo: JSON.parse(config.provider_configs_json)[config.provider]?.modelo ?? config.modelo,
    })),
  }
})

describe('knowledge enrichment config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbState.configValues = {}
    dbState.iaConfig = { ...dbState.defaultIaConfig }
    dbState.localDownloaded = true
    dbState.localUsable = true
    dbState.validateCalls = 0
  })

  it('returns automatic enrichment model selection by default', async () => {
    const { getKnowledgeEnrichmentConfig } = await import('../../../src/main/knowledge/enrichment-config')

    await expect(getKnowledgeEnrichmentConfig()).resolves.toEqual({
      auto_enrich_after_import: false,
      provider: 'auto',
      modelo: 'auto',
      force_all_default: false,
    })
  })

  it('saves normalized enrichment config', async () => {
    const { saveKnowledgeEnrichmentConfig, getKnowledgeEnrichmentConfig } = await import('../../../src/main/knowledge/enrichment-config')

    const saved = await saveKnowledgeEnrichmentConfig({
      auto_enrich_after_import: true,
      provider: 'auto',
      modelo: 'gemma-4-e2b-it-q4',
    })

    expect(saved.auto_enrich_after_import).toBe(true)
    expect(saved.provider).toBe('auto')
    await expect(getKnowledgeEnrichmentConfig()).resolves.toMatchObject({ provider: 'auto' })
  })

  it('lists local and cloud model availability', async () => {
    const { listKnowledgeEnrichmentModelOptions } = await import('../../../src/main/knowledge/enrichment-config')

    const models = await listKnowledgeEnrichmentModelOptions()

    expect(models).toContainEqual(expect.objectContaining({
      provider: 'local',
      modelo: 'gemma-4-e2b-it-q4',
      available: true,
    }))
    expect(models).toContainEqual(expect.objectContaining({
      provider: 'openrouter',
      available: true,
    }))
  })

  it('auto resolver prefers local when downloaded', async () => {
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    const model = await buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'auto',
      modelo: 'ignored',
      force_all_default: false,
    })

    expect(model).toMatchObject({ provider: 'local', modelo: 'gemma-4-e2b-it-q4' })
  })

  it('auto resolver falls back to cloud when local is missing', async () => {
    dbState.localDownloaded = false
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    const model = await buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'auto',
      modelo: 'ignored',
      force_all_default: false,
    })

    expect(model).toMatchObject({ provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' })
  })

  it('auto resolver validates local route before falling back to cloud', async () => {
    dbState.localDownloaded = true
    dbState.localUsable = false
    const { listKnowledgeEnrichmentModelOptions, buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    const models = await listKnowledgeEnrichmentModelOptions()
    expect(models).toContainEqual(expect.objectContaining({
      provider: 'local',
      modelo: 'gemma-4-e2b-it-q4',
      available: false,
      reason: expect.stringContaining('precisa passar em Testar conexao'),
    }))

    const model = await buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'auto',
      modelo: 'ignored',
      force_all_default: false,
    })

    expect(model).toMatchObject({ provider: 'local', modelo: 'gemma-4-e2b-it-q4' })
    expect(dbState.validateCalls).toBe(1)
  })

  it('uses rag_enrichment route instead of persisted enrichment provider when not explicit override', async () => {
    dbState.configValues['ia.routing'] = {
      global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
      tasks: {
        rag_enrichment: {
          mode: 'explicit',
          provider: 'openrouter',
          modelo: 'openai/gpt-oss-20b:free',
        },
      },
    }
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    const model = await buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'local',
      modelo: 'gemma-4-e2b-it-q4',
      force_all_default: false,
    })

    expect(model).toMatchObject({ provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' })
  })

  it('keeps routed OpenRouter token from legacy api_key fallback', async () => {
    dbState.iaConfig = {
      ...dbState.iaConfig,
      provider: 'openrouter',
      api_key: 'legacy-openrouter-token',
      provider_configs_json: JSON.stringify({
        openrouter: { modelo: 'openai/gpt-oss-20b:free' },
        gemini: { token: '', modelo: 'gemini-3.5-flash' },
        local: { modelo: 'gemma-4-e2b-it-q4' },
      }),
    }
    dbState.configValues['ia.routing'] = {
      global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
      tasks: {
        rag_enrichment: {
          mode: 'explicit',
          provider: 'openrouter',
          modelo: 'openai/gpt-oss-20b:free',
        },
      },
    }
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')
    const { buildModelFactory } = await import('../../../src/main/ia/config')

    await buildKnowledgeEnrichmentModel()

    expect(vi.mocked(buildModelFactory).mock.calls.at(-1)?.[0]).toMatchObject({
      provider: 'openrouter',
      api_key: 'legacy-openrouter-token',
    })
  })

  it('preserves explicit enrichment override when requested with non-auto provider', async () => {
    dbState.configValues['ia.routing'] = {
      global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
      tasks: {
        rag_enrichment: {
          mode: 'explicit',
          provider: 'local',
          modelo: 'gemma-4-e2b-it-q4',
        },
      },
    }
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    const model = await buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'openrouter',
      modelo: 'openai/gpt-oss-20b:free',
      force_all_default: false,
    }, {
      explicitOverride: true,
    })

    expect(model).toMatchObject({ provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' })
  })

  it('throws the specific route reason instead of returning a silent null when enrichment route is not ready', async () => {
    dbState.localDownloaded = false
    dbState.configValues['ia.routing'] = {
      global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
      tasks: {
        rag_enrichment: { mode: 'explicit', provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
      },
    }
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    await expect(buildKnowledgeEnrichmentModel()).rejects.toThrow(/baixad/i)
  })

  it('rejects an explicit model without a provider instead of silently routing past it', async () => {
    const { buildKnowledgeEnrichmentModel } = await import('../../../src/main/knowledge/enrichment-config')

    await expect(buildKnowledgeEnrichmentModel(
      {
        auto_enrich_after_import: false,
        provider: 'auto',
        modelo: 'openai/gpt-oss-20b:free',
        force_all_default: false,
      },
      { explicitOverride: true },
    )).rejects.toThrow(/provider/i)
  })
})
