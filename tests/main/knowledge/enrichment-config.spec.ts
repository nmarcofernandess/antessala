import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbState = vi.hoisted(() => ({
  configValues: {} as Record<string, unknown>,
  iaConfig: {
    id: 1,
    provider: 'openrouter' as const,
    api_key: '',
    modelo: 'openai/gpt-oss-20b:free',
    provider_configs_json: JSON.stringify({
      openrouter: { token: 'sk-or-test', modelo: 'openai/gpt-oss-20b:free' },
      gemini: { token: '', modelo: 'gemini-3.5-flash' },
    }),
    ativo: true,
    memoria_automatica: false,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  } as any,
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: vi.fn(async (sql: string, key?: string) => {
    if (sql.includes('FROM configuracao_ia')) return dbState.iaConfig
    if (sql.includes('FROM config')) {
      return dbState.configValues[key ?? ''] === undefined
        ? undefined
        : { value: dbState.configValues[key ?? ''] }
    }
    return undefined
  }),
  execute: vi.fn(async (_sql: string, key: string, value: string) => {
    dbState.configValues[key] = JSON.parse(value)
    return { changes: 1 }
  }),
}))

vi.mock('../../../src/main/knowledge/enrichment', () => ({
  createAiSdkEnrichmentModel: vi.fn((_createModel: unknown, modelo: string, provider: string) => ({
    provider,
    modelo,
    generate: vi.fn(),
  })),
}))

vi.mock('../../../src/main/ia/config', async () => {
  const actual = await vi.importActual<typeof import('../../../src/main/ia/config')>(
    '../../../src/main/ia/config',
  )
  return {
    ...actual,
    buildModelFactory: vi.fn((config: any) => ({
      createModel: vi.fn(),
      modelo: JSON.parse(config.provider_configs_json)[config.provider]?.modelo ?? config.modelo,
    })),
  }
})

describe('knowledge enrichment config dormente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbState.configValues = {}
    dbState.iaConfig = {
      ...dbState.iaConfig,
      provider: 'openrouter',
      api_key: '',
      modelo: 'openai/gpt-oss-20b:free',
      provider_configs_json: JSON.stringify({
        openrouter: { token: 'sk-or-test', modelo: 'openai/gpt-oss-20b:free' },
        gemini: { token: '', modelo: 'gemini-3.5-flash' },
      }),
    }
  })

  it('mantém enriquecimento automático desligado por padrão', async () => {
    const { getKnowledgeEnrichmentConfig } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    await expect(getKnowledgeEnrichmentConfig()).resolves.toEqual({
      auto_enrich_after_import: false,
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
      force_all_default: false,
    })
  })

  it('normaliza configuração legada local para Gemini sem ressuscitar modelo local', async () => {
    dbState.configValues['knowledge.enrichment'] = {
      auto_enrich_after_import: true,
      provider: 'local',
      modelo: 'gemma-legado',
      force_all_default: false,
    }
    const { getKnowledgeEnrichmentConfig } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    await expect(getKnowledgeEnrichmentConfig()).resolves.toMatchObject({
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
    })
  })

  it('normaliza qualquer provider legado para Gemini', async () => {
    const { saveKnowledgeEnrichmentConfig } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    await expect(saveKnowledgeEnrichmentConfig({
      auto_enrich_after_import: true,
      provider: 'openrouter',
      modelo: 'openai/gpt-oss-20b:free',
    })).resolves.toMatchObject({
      auto_enrich_after_import: true,
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
    })
  })

  it('lista somente Gemini', async () => {
    const { listKnowledgeEnrichmentModelOptions } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    const options = await listKnowledgeEnrichmentModelOptions()
    expect(options.map((option) => option.provider)).toEqual(['gemini'])
  })

  it('usa Gemini mesmo diante de configuração OpenRouter legada', async () => {
    dbState.iaConfig = {
      ...dbState.iaConfig,
      provider_configs_json: JSON.stringify({
        openrouter: { token: 'sk-or-test', modelo: 'openai/gpt-oss-20b:free' },
        gemini: { token: 'gemini-test', modelo: 'gemini-3.5-flash' },
      }),
    }
    const { buildKnowledgeEnrichmentModel } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    await expect(buildKnowledgeEnrichmentModel()).resolves.toMatchObject({
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
    })
  })

  it('não reaproveita token legado OpenRouter como Gemini', async () => {
    dbState.iaConfig = {
      ...dbState.iaConfig,
      api_key: 'legacy-openrouter-token',
      provider_configs_json: JSON.stringify({
        openrouter: { modelo: 'openai/gpt-oss-20b:free' },
        gemini: { modelo: 'gemini-3.5-flash' },
      }),
    }
    const { buildKnowledgeEnrichmentModel } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )
    const { buildModelFactory } = await import('../../../src/main/ia/config')

    await expect(buildKnowledgeEnrichmentModel()).rejects.toThrow(/Gemini configurado/i)
    expect(buildModelFactory).not.toHaveBeenCalled()
  })

  it('normaliza modo auto legado para Gemini', async () => {
    const { buildKnowledgeEnrichmentModel } = await import(
      '../../../src/main/knowledge/enrichment-config'
    )

    await expect(buildKnowledgeEnrichmentModel({
      auto_enrich_after_import: false,
      provider: 'auto',
      modelo: 'openai/gpt-oss-20b:free',
      force_all_default: false,
    }, { explicitOverride: true })).resolves.toMatchObject({
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
    })
  })
})
