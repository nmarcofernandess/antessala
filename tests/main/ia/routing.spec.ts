import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_ROUTE_TASK_LABELS,
  AI_ROUTE_TASKS,
  DEFAULT_IA_ROUTING_CONFIG,
  IA_ROUTING_CONFIG_KEY,
  normalizeIaRoutingConfig,
} from '../../../src/shared/ia-routing-contract'

const state = vi.hoisted(() => ({
  routingRow: undefined as { value: unknown } | undefined,
  activeConfig: null as any,
  execute: vi.fn(async () => ({ changes: 1 })),
  geminiEnabled: true,
  localStatus: {
    baixado: false,
    usable: false,
    requires_validation: false,
    load_error: undefined as string | undefined,
  },
  validateCalls: 0,
}))

vi.mock('../../../src/main/db/query', () => ({
  queryOne: vi.fn(async (sql: string) => {
    if (sql.includes('FROM configuracao_ia')) return state.activeConfig
    if (sql.includes('FROM config')) return state.routingRow
    return undefined
  }),
  execute: state.execute,
}))

vi.mock('../../../src/main/config/app-config', () => ({
  // getModelDir (real, via getModelPath não-mockado) lê APP_CONFIG.name.
  APP_CONFIG: { name: 'FlowKit' },
  isGeminiCloudApiEnabled: vi.fn(() => state.geminiEnabled),
}))

vi.mock('../../../src/main/ia/local-llm', () => ({
  LOCAL_MODELS: {
    'gemma-4-e2b-it-q4': {
      label: 'Gemma 4 E2B IT',
      filename: 'gemma-4-E2B-it-Q4_K_M.gguf',
      url: 'https://example.test/model.gguf',
      size_bytes: 3_110_000_000,
      ram_minima_gb: 4,
      descricao: 'test',
    },
  },
  getLocalStatus: vi.fn(() => ({
    modelos: {
      'gemma-4-e2b-it-q4': { ...state.localStatus },
    },
    modelo_carregado: state.localStatus.usable,
  })),
  validateLocalModel: vi.fn(async () => {
    state.validateCalls++
    state.localStatus = {
      ...state.localStatus,
      usable: true,
      requires_validation: false,
      load_error: undefined,
    }
    return state.localStatus
  }),
}))

function activeOpenRouterConfig(overrides: Partial<any> = {}) {
  return {
    id: 1,
    provider: 'openrouter',
    api_key: '',
    modelo: 'openai/gpt-oss-20b:free',
    provider_configs_json: JSON.stringify({
      local: { modelo: 'gemma-4-e2b-it-q4' },
      openrouter: { token: 'or-token', modelo: 'openai/gpt-oss-20b:free' },
      gemini: { token: '', modelo: 'gemini-3.5-flash' },
    }),
    ativo: true,
    memoria_automatica: true,
    criado_em: '2026-06-14T00:00:00.000Z',
    atualizado_em: '2026-06-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('IA routing contract', () => {
  it('has labels for every route task', () => {
    for (const task of AI_ROUTE_TASKS) {
      expect(AI_ROUTE_TASK_LABELS[task], `${task} label`).toEqual(expect.any(String))
      expect(AI_ROUTE_TASK_LABELS[task].length).toBeGreaterThan(3)
    }
  })

  it('includes maia_command as the Maiá route extension (inherits the global brain)', () => {
    expect(AI_ROUTE_TASKS).toContain('maia_command')
    expect(AI_ROUTE_TASK_LABELS.maia_command).toBe('Maiá')
    expect(DEFAULT_IA_ROUTING_CONFIG.tasks.maia_command).toEqual({ mode: 'inherit' })
  })

  it('normalizes missing config to local global default and inherited chat tasks', () => {
    const config = normalizeIaRoutingConfig(undefined)

    expect(config).toMatchObject({
      version: 1,
      global: {
        provider: 'local',
        modelo: 'gemma-4-e2b-it-q4',
      },
      tasks: {
        chat_ui: { mode: 'inherit' },
        cli_chat: { mode: 'inherit' },
        rag_metadata: { mode: 'explicit', provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        rag_enrichment: { mode: 'auto' },
      },
    })
    expect(Object.keys(config.tasks).sort()).toEqual([...AI_ROUTE_TASKS].sort())
  })

  it('normalizes JSON string config and trims explicit models', () => {
    const config = normalizeIaRoutingConfig(JSON.stringify({
      global: { provider: 'openrouter', modelo: '  openai/gpt-oss-20b:free  ' },
      tasks: {
        cli_chat: { mode: 'explicit', provider: 'gemini', modelo: '  gemini-3.5-flash  ' },
      },
    }))

    expect(config.global).toEqual({ provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' })
    expect(config.tasks.cli_chat).toEqual({ mode: 'explicit', provider: 'gemini', modelo: 'gemini-3.5-flash' })
  })

  it('drops invalid task config to task fallback', () => {
    const config = normalizeIaRoutingConfig({
      version: 99,
      tasks: {
        rag_metadata: {
          mode: 'explicit',
          provider: 'banana',
          modelo: '   ',
        },
      },
    })

    expect(config.version).toBe(1)
    expect(config.tasks.rag_metadata).toEqual({
      mode: 'explicit',
      provider: 'local',
      modelo: 'gemma-4-e2b-it-q4',
    })
  })
})

describe('IA route resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.routingRow = undefined
    state.activeConfig = null
    state.geminiEnabled = true
    state.localStatus = {
      baixado: false,
      usable: false,
      requires_validation: false,
      load_error: undefined,
    }
    state.validateCalls = 0
  })

  it('saves normalized routing config into config JSONB', async () => {
    const { saveIaRoutingConfig } = await import('../../../src/main/ia/routing')

    const saved = await saveIaRoutingConfig({
      global: {
        provider: 'openrouter',
        modelo: '  openai/gpt-oss-20b:free  ',
      },
      tasks: {
        chat_ui: { mode: 'inherit' },
        rag_enrichment: { mode: 'auto', provider: 'banana', modelo: '' },
      },
    })

    expect(saved.global).toEqual({
      provider: 'openrouter',
      modelo: 'openai/gpt-oss-20b:free',
    })
    expect(state.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO config'),
      IA_ROUTING_CONFIG_KEY,
      expect.any(String),
    )

    const persisted = JSON.parse(state.execute.mock.calls[0][2])
    expect(persisted).toEqual(saved)
    expect(persisted.tasks.rag_enrichment).toEqual({ mode: 'auto' })
  })

  it('keeps explicit local route unavailable until local model is usable', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        tasks: {
          chat_ui: { mode: 'explicit', provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        },
      },
    }
    state.localStatus = {
      baixado: true,
      usable: false,
      requires_validation: true,
      load_error: undefined,
    }

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('chat_ui')).resolves.toMatchObject({
      ok: false,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'validate_local_model',
      inherited: false,
      auto_selected: false,
    })

    state.localStatus = {
      ...state.localStatus,
      usable: true,
      requires_validation: false,
    }

    await expect(resolveIaRoute('chat_ui')).resolves.toMatchObject({
      ok: true,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'ready',
      inherited: false,
      auto_selected: false,
    })
  })

  it('does not silently fallback when inherited global provider is unavailable', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'gemini', modelo: 'gemini-3.5-flash' },
        tasks: {
          chat_ui: { mode: 'inherit' },
        },
      },
    }
    state.activeConfig = activeOpenRouterConfig()
    state.localStatus = {
      baixado: true,
      usable: true,
      requires_validation: false,
      load_error: undefined,
    }

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('chat_ui')).resolves.toMatchObject({
      ok: false,
      mode: 'inherit',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      reason: 'configure_cloud_token',
      inherited: true,
      auto_selected: false,
    })
  })

  it('uses default local global route without ia.routing row, not active OpenRouter or Gemini', async () => {
    state.routingRow = undefined
    state.activeConfig = activeOpenRouterConfig()
    state.localStatus = {
      baixado: true,
      usable: true,
      requires_validation: false,
      load_error: undefined,
    }

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('chat_ui')).resolves.toMatchObject({
      ok: true,
      mode: 'inherit',
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'ready',
      inherited: true,
      auto_selected: false,
    })
  })

  it('resolves auto route to first ready candidate and records attempted failures', async () => {
    state.routingRow = {
      value: {
        global: DEFAULT_IA_ROUTING_CONFIG.global,
        tasks: { rag_enrichment: { mode: 'auto' } },
      },
    }
    state.activeConfig = activeOpenRouterConfig()
    state.localStatus = {
      baixado: true,
      usable: false,
      requires_validation: true,
      load_error: undefined,
    }

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('rag_enrichment')).resolves.toMatchObject({
      ok: true,
      mode: 'auto',
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
      reason: 'ready',
      inherited: false,
      auto_selected: true,
      attempted: [
        {
          provider: 'local',
          model: 'gemma-4-e2b-it-q4',
          reason: 'validate_local_model',
        },
      ],
    })
  })

  it('returns helpful auto failure when no candidate is ready', async () => {
    state.routingRow = {
      value: {
        global: DEFAULT_IA_ROUTING_CONFIG.global,
        tasks: { rag_enrichment: { mode: 'auto' } },
      },
    }
    state.activeConfig = activeOpenRouterConfig({
      provider_configs_json: JSON.stringify({
        local: { modelo: 'gemma-4-e2b-it-q4' },
        openrouter: { token: '', modelo: 'openai/gpt-oss-20b:free' },
        gemini: { token: '', modelo: 'gemini-3.5-flash' },
      }),
    })
    state.localStatus = {
      baixado: false,
      usable: false,
      requires_validation: false,
      load_error: undefined,
    }

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('rag_enrichment')).resolves.toMatchObject({
      ok: false,
      mode: 'auto',
      provider: null,
      model: null,
      reason: 'auto_no_ready_route',
      inherited: false,
      auto_selected: false,
    })
  })

  it('validates local model when requested and assertIaRouteReady returns ready route', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        tasks: { chat_ui: { mode: 'inherit' } },
      },
    }
    state.localStatus = {
      baixado: true,
      usable: false,
      requires_validation: true,
      load_error: undefined,
    }

    const { assertIaRouteReady } = await import('../../../src/main/ia/routing')

    await expect(assertIaRouteReady('chat_ui', { validateLocal: true })).resolves.toMatchObject({
      ok: true,
      provider: 'local',
      model: 'gemma-4-e2b-it-q4',
      reason: 'ready',
    })
    expect(state.validateCalls).toBe(1)
  })

  it('reports Gemini disabled and cloud token success/failure', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'gemini', modelo: 'gemini-3.5-flash' },
        tasks: {
          chat_ui: { mode: 'inherit' },
          cli_chat: { mode: 'explicit', provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' },
        },
      },
    }
    state.activeConfig = activeOpenRouterConfig()
    state.geminiEnabled = false

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('chat_ui')).resolves.toMatchObject({
      ok: false,
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      reason: 'gemini_disabled',
    })
    await expect(resolveIaRoute('cli_chat')).resolves.toMatchObject({
      ok: true,
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
      reason: 'ready',
    })
  })

  it('uses saved provider tokens even when the config row is inactive', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        tasks: {
          cli_chat: { mode: 'explicit', provider: 'openrouter', modelo: 'openai/gpt-oss-20b:free' },
        },
      },
    }
    state.activeConfig = activeOpenRouterConfig({ ativo: false })

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('cli_chat')).resolves.toMatchObject({
      ok: true,
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b:free',
      reason: 'ready',
    })
  })

  it('rejects provider-incompatible cloud models before runtime generation', async () => {
    state.routingRow = {
      value: {
        global: { provider: 'local', modelo: 'gemma-4-e2b-it-q4' },
        tasks: {
          cli_chat: { mode: 'explicit', provider: 'gemini', modelo: 'openai/gpt-oss-20b:free' },
        },
      },
    }
    state.activeConfig = activeOpenRouterConfig({
      provider: 'gemini',
      api_key: 'gemini-token',
    })

    const { resolveIaRoute } = await import('../../../src/main/ia/routing')

    await expect(resolveIaRoute('cli_chat')).resolves.toMatchObject({
      ok: false,
      provider: 'gemini',
      model: 'openai/gpt-oss-20b:free',
      reason: 'unsupported_model',
    })
  })

  it('resolves all route statuses as an ordered array', async () => {
    state.routingRow = undefined
    state.localStatus = {
      baixado: true,
      usable: true,
      requires_validation: false,
      load_error: undefined,
    }

    const { resolveAllIaRoutes } = await import('../../../src/main/ia/routing')
    const routes = await resolveAllIaRoutes()

    expect(routes.map((route) => route.task)).toEqual(AI_ROUTE_TASKS)
    expect(routes.every((route) => typeof route.label === 'string' && route.label.length > 3)).toBe(true)
  })
})
