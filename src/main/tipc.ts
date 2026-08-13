import { writeFile, rm } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import os from 'node:os'
import { queryOne, queryAll, execute, insertReturningId, transaction, execDDL } from './db/query'
import { galleryListar as _galleryListar, galleryUpload as _galleryUpload, galleryRemover, galleryToggleFavorito, galleryAtualizarTags, galleryLerArquivo } from './gallery/service'
import path from 'node:path'
import { iaEnviarMensagem, iaEnviarMensagemStream, iaTestarConexao } from './ia/cliente'
import { PROVIDER_DEFAULTS } from './ia/config'
import { getIaRoutingConfig, resolveAllIaRoutes, resolveIaRoute, saveIaRoutingConfig } from './ia/routing'
import { resolveMcpPath, isMcpSource } from './mcp-path'
import { runCronPipeline } from './cron/pipeline'
import { isGeminiCloudApiEnabled } from './config/app-config'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { tipc } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')

const t = tipc.create()
const { dialog, BrowserWindow, app } = electron
const execFileAsync = promisify(execFile)
const OPENROUTER_FREE_ROUTER_MODEL = 'openrouter/free'

function parseJsonConfigValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// =============================================================================
// ANEXOS — persistência em disco
// =============================================================================

function getAnexosBaseDir(): string {
  try {
    if (app?.isPackaged && app.getPath) {
      return path.join(app.getPath('userData'), 'anexos')
    }
  } catch { /* fallback */ }
  return path.join(__dirname, '../../data/anexos')
}

function getAnexosConversaDir(conversa_id: string): string {
  const dir = path.join(getAnexosBaseDir(), conversa_id)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/bmp': '.bmp', 'application/pdf': '.pdf',
    'text/plain': '.txt', 'text/markdown': '.md', 'application/json': '.json',
  }
  return map[mime] || '.bin'
}

async function limparAnexosConversa(conversa_id: string): Promise<void> {
  const dir = path.join(getAnexosBaseDir(), conversa_id)
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true })
  }
}

async function limparAnexosArquivadas(): Promise<void> {
  const arquivadas = await queryAll<{ id: string }>(
    `SELECT id FROM ia_conversas WHERE status = 'arquivado'`
  )
  for (const c of arquivadas) {
    await limparAnexosConversa(c.id)
  }
}

function safeJsonParse<T = unknown>(json: string | null | undefined): T | undefined {
  if (!json) return undefined
  try { return JSON.parse(json) as T }
  catch { return undefined }
}

// =============================================================================
// IA CONFIGURAÇÃO
// =============================================================================

type IaProviderKey = 'gemini' | 'openrouter' | 'local'

type IaProviderConfig = {
  token?: string
  modelo?: string
  favoritos?: string[]
}

type IaProviderConfigs = Partial<Record<IaProviderKey, IaProviderConfig>>

const IA_PROVIDER_LABELS: Record<IaProviderKey, string> = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  local: 'IA Local',
}

function parseIaProviderConfigs(raw: unknown): IaProviderConfigs {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as IaProviderConfigs
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as IaProviderConfigs) : {}
  } catch {
    return {}
  }
}

function serializeIaProviderConfigs(configs: IaProviderConfigs): string {
  try {
    return JSON.stringify(configs ?? {})
  } catch {
    return '{}'
  }
}

function normalizeIaConfigRow(raw: any) {
  if (!raw) return null
  const providerConfigs = parseIaProviderConfigs(raw.provider_configs_json)
  return {
    ...raw,
    provider_configs_json: serializeIaProviderConfigs(providerConfigs),
    provider_configs: providerConfigs,
  }
}

function getProviderToken(config: any, provider: IaProviderKey): string {
  const providerConfigs = parseIaProviderConfigs(config?.provider_configs_json ?? config?.provider_configs)
  const providerCfg = providerConfigs?.[provider]
  if (providerCfg?.token?.trim()) return providerCfg.token.trim()
  if (provider === config?.provider && typeof config?.api_key === 'string' && config.api_key.trim()) {
    return config.api_key.trim()
  }
  return ''
}

function getProviderModel(config: any, provider: IaProviderKey): string {
  const providerConfigs = parseIaProviderConfigs(config?.provider_configs_json ?? config?.provider_configs)
  const configured = providerConfigs?.[provider]?.modelo?.trim()
  if (configured) return configured
  if (provider === config?.provider && typeof config?.modelo === 'string' && config.modelo.trim()) {
    return config.modelo.trim()
  }
  if (provider === 'openrouter') return PROVIDER_DEFAULTS.openrouter
  if (provider === 'local') return PROVIDER_DEFAULTS.local
  return PROVIDER_DEFAULTS.gemini
}

function dedupeCapabilityModels(models: import('@shared/index').IaCapabilityModel[]) {
  const seen = new Set<string>()
  return models.filter((model) => {
    if (!model.id || seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

function inferCapabilityStatus(
  activeProvider: IaProviderKey | null,
  activeAvailable: boolean,
  activeReason?: string,
): import('@shared/index').IaCapabilityStatus {
  if (!activeProvider) return 'unconfigured'
  if (activeAvailable) return activeProvider === 'local' ? 'ready_local' : 'ready_cloud'
  if (activeProvider === 'local' && activeReason?.toLowerCase().includes('falhou')) return 'local_model_error'
  if (activeProvider === 'local' && activeReason?.toLowerCase().includes('test')) return 'local_model_needs_validation'
  if (activeProvider === 'local') return 'missing_local_model'
  return 'missing_cloud_token'
}

async function getIaCapabilities(rawConfig?: any): Promise<import('@shared/index').IaCapabilities> {
  const geminiCloudOn = isGeminiCloudApiEnabled()
  const geminiBlockedReason = 'Gemini API direta desativada por FLOWKIT_GEMINI_ENABLE=0. Use OpenRouter ou modelo local.'
  const config = normalizeIaConfigRow(rawConfig)

  if (!config) {
    const geminiUnconfiguredReason = geminiCloudOn ? 'API key não configurada.' : geminiBlockedReason
    const { findLlamaServerBinary } = await import('./ia/llama-server-runtime')
    return {
      provider: null,
      status: 'unconfigured',
      has_any_available_provider: false,
      active_provider: null,
      active_provider_available: false,
      show_unconfigured_state: true,
      gemini_cloud_api_enabled: geminiCloudOn,
      local_server_binary_available: findLlamaServerBinary() !== null,
      providers: [
        {
          provider: 'gemini',
          label: IA_PROVIDER_LABELS.gemini,
          available: false,
          disabled: true,
          reason: geminiUnconfiguredReason,
          models: dedupeCapabilityModels(staticGeminiCatalog().models.map((model) => ({
            id: model.id,
            label: model.label,
            available: false,
            disabled: true,
            reason: geminiUnconfiguredReason,
          }))),
        },
        {
          provider: 'openrouter',
          label: IA_PROVIDER_LABELS.openrouter,
          available: false,
          disabled: true,
          reason: 'API key não configurada.',
          models: [{
            id: PROVIDER_DEFAULTS.openrouter,
            label: PROVIDER_DEFAULTS.openrouter,
            available: false,
            disabled: true,
            reason: 'API key não configurada.',
          }, {
            id: OPENROUTER_FREE_ROUTER_MODEL,
            label: 'Free Models Router',
            available: false,
            disabled: true,
            reason: 'API key não configurada.',
          }],
        },
        {
          provider: 'local',
          label: IA_PROVIDER_LABELS.local,
          available: false,
          disabled: true,
          reason: 'Nenhum modelo local instalado.',
          models: [],
        },
      ],
      can_chat: false,
      can_test_connection: false,
      can_load_remote_catalog: false,
      can_use_cloud_llm_features: false,
      reason: 'configure_provider',
      message: 'Selecione um provider de IA nas Configurações para usar o assistente.',
    }
  }

  const { LOCAL_MODELS, getLocalStatus } = await import('./ia/local-llm')
  const localStatus = getLocalStatus()

  const geminiToken = getProviderToken(config, 'gemini')
  const geminiAvailable = geminiCloudOn && geminiToken.length > 0
  const geminiReason = !geminiCloudOn
    ? geminiBlockedReason
    : (geminiAvailable ? undefined : 'API key não configurada.')
  const geminiModels = dedupeCapabilityModels([
    ...staticGeminiCatalog().models.map((model) => ({
      id: model.id,
      label: model.label,
      available: geminiAvailable,
      disabled: !geminiAvailable,
      reason: geminiReason,
    })),
    {
      id: getProviderModel(config, 'gemini'),
      label: getProviderModel(config, 'gemini'),
      available: geminiAvailable,
      disabled: !geminiAvailable,
      reason: geminiReason,
    },
  ])

  const openrouterToken = getProviderToken(config, 'openrouter')
  const openrouterAvailable = openrouterToken.length > 0
  const openrouterReason = openrouterAvailable ? undefined : 'API key não configurada.'
  const openrouterSavedModel = getProviderModel(config, 'openrouter')
  const openrouterFavorites = parseIaProviderConfigs(config.provider_configs_json).openrouter?.favoritos ?? []
  const openrouterModels = dedupeCapabilityModels([
    {
      id: PROVIDER_DEFAULTS.openrouter,
      label: PROVIDER_DEFAULTS.openrouter,
      available: openrouterAvailable,
      disabled: !openrouterAvailable,
      reason: openrouterReason,
    },
    {
      id: OPENROUTER_FREE_ROUTER_MODEL,
      label: 'Free Models Router',
      available: openrouterAvailable,
      disabled: !openrouterAvailable,
      reason: openrouterReason,
    },
    ...openrouterFavorites.map((modelId) => ({
      id: modelId,
      label: modelId,
      available: openrouterAvailable,
      disabled: !openrouterAvailable,
      reason: openrouterReason,
    })),
    {
      id: openrouterSavedModel,
      label: openrouterSavedModel,
      available: openrouterAvailable,
      disabled: !openrouterAvailable,
      reason: openrouterReason,
    },
  ])

  const localModels = dedupeCapabilityModels(
    (Object.entries(LOCAL_MODELS) as Array<[string, typeof LOCAL_MODELS[keyof typeof LOCAL_MODELS]]>).map(([modelId, model]) => {
      const status = localStatus.modelos[modelId]
      const usable = Boolean(status?.usable)
      const downloaded = Boolean(status?.baixado)
      const reason = status?.load_error
        ? `Modelo local falhou ao carregar: ${status.load_error}`
        : downloaded && status?.requires_validation
          ? 'Modelo baixado, mas ainda precisa passar em Testar conexao.'
          : 'Modelo não instalado.'
      return {
        id: modelId,
        label: model.label,
        available: usable,
        disabled: !usable,
        reason: usable ? undefined : reason,
      }
    })
  )
  const localAvailable = localModels.some((model) => model.available)
  const downloadedLocal = Object.values(localStatus.modelos).some((model) => model.baixado)
  const localErrored = Object.values(localStatus.modelos).find((model) => model.load_error)
  const localNeedsValidation = Object.values(localStatus.modelos).some((model) => model.requires_validation)
  const localReason = localAvailable
    ? undefined
    : localErrored?.load_error
      ? `Modelo local falhou ao carregar: ${localErrored.load_error}`
      : localNeedsValidation
        ? 'Modelo local baixado, mas ainda precisa passar em Testar conexao.'
        : downloadedLocal
          ? 'Modelo local baixado, mas ainda nao validado.'
          : 'Nenhum modelo local instalado.'

  const providers: import('@shared/index').IaCapabilityProvider[] = [
    {
      provider: 'gemini',
      label: IA_PROVIDER_LABELS.gemini,
      available: geminiAvailable,
      disabled: !geminiAvailable,
      reason: geminiReason,
      models: geminiModels,
    },
    {
      provider: 'openrouter',
      label: IA_PROVIDER_LABELS.openrouter,
      available: openrouterAvailable,
      disabled: !openrouterAvailable,
      reason: openrouterReason,
      models: openrouterModels,
    },
    {
      provider: 'local',
      label: IA_PROVIDER_LABELS.local,
      available: localAvailable,
      disabled: !localAvailable,
      reason: localReason,
      models: localModels,
    },
  ]

  const activeProvider = (config.provider ?? null) as IaProviderKey | null
  const activeProviderEntry = providers.find((provider) => provider.provider === activeProvider) ?? null
  const hasAnyAvailableProvider = providers.some((provider) => provider.available)
  const activeProviderAvailable = Boolean(activeProviderEntry?.available)
  const activeReason = activeProviderEntry?.reason
  const showUnconfiguredState = !hasAnyAvailableProvider
  const status = inferCapabilityStatus(activeProvider, activeProviderAvailable, activeReason)
  const activeLocalModelDownloaded = activeProvider === 'local'
    ? Object.values(localStatus.modelos).some((model) => model.baixado)
    : false
  const activeCanTestConnection = activeProvider === 'local'
    ? activeLocalModelDownloaded
    : activeProviderAvailable

  let reason: import('@shared/index').IaCapabilities['reason'] | undefined
  if (!activeProvider) {
    reason = 'configure_provider'
  } else if (!activeProviderAvailable && activeProvider === 'local') {
    reason = status === 'local_model_error'
      ? 'local_model_error'
      : status === 'local_model_needs_validation'
        ? 'validate_local_model'
        : 'download_local_model'
  } else if (!activeProviderAvailable && activeProvider) {
    reason = 'configure_cloud_token'
  }

  const message = activeProvider && !activeProviderAvailable
    ? `${activeProviderEntry?.label ?? 'Provider'} indisponível: ${activeReason}`
    : showUnconfiguredState
      ? (geminiCloudOn
        ? 'Nenhum provider de IA está disponível. Configure Gemini/OpenRouter ou baixe um modelo local.'
        : 'Nenhum provider de IA está disponível. Configure OpenRouter ou baixe um modelo local.')
      : `${activeProviderEntry?.label ?? 'Provider'} pronto para uso.`

  return {
    provider: activeProvider,
    status,
    has_any_available_provider: hasAnyAvailableProvider,
    active_provider: activeProvider,
    active_provider_available: activeProviderAvailable,
    show_unconfigured_state: showUnconfiguredState,
    gemini_cloud_api_enabled: geminiCloudOn,
    providers,
    can_chat: activeProviderAvailable,
    can_test_connection: activeCanTestConnection,
    can_load_remote_catalog: (activeProvider === 'gemini' && geminiCloudOn) || activeProvider === 'openrouter',
    can_use_cloud_llm_features: activeProviderAvailable && activeProvider !== 'local',
    local_server_binary_available: localStatus.server_binary_available === true,
    reason,
    message,
  }
}

async function requireCloudLlmFeature(featureLabel: string): Promise<any> {
  const config = await queryOne('SELECT * FROM configuracao_ia LIMIT 1')
  const capabilities = await getIaCapabilities(config)

  if (!config || capabilities.status === 'unconfigured') {
    throw new Error('Assistente IA não configurado. Selecione um provider nas Configurações.')
  }

  if (config.provider === 'local') {
    throw new Error(
      isGeminiCloudApiEnabled()
        ? `${featureLabel} ainda requer um provider cloud (Gemini ou OpenRouter).`
        : `${featureLabel} ainda requer um provider cloud (OpenRouter).`,
    )
  }

  if (config.provider === 'gemini' && !isGeminiCloudApiEnabled()) {
    throw new Error(`${featureLabel} requer OpenRouter ou modelo local (Gemini API direta desativada por FLOWKIT_GEMINI_ENABLE=0).`)
  }

  if (!capabilities.can_use_cloud_llm_features) {
    throw new Error(`${featureLabel} requer token do provider cloud configurado.`)
  }

  return config
}

async function formatIaConfigForRenderer(raw: any) {
  const normalized = normalizeIaConfigRow(raw)
  if (!normalized) return null
  const capabilities = await getIaCapabilities(normalized)
  return {
    ...normalized,
    ativo: capabilities.active_provider_available,
  }
}

type IaModelCatalogProvider = 'gemini' | 'openrouter' | 'local'

type IaModelCatalogItem = {
  id: string
  label: string
  provider: IaModelCatalogProvider
  source: 'static' | 'api' | 'fallback'
  description?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  is_free?: boolean
  supports_tools?: boolean
  is_agentic?: boolean
  tags?: string[]
}

type IaModelCatalogResult = {
  provider: IaModelCatalogProvider
  source: 'static' | 'api' | 'fallback'
  models: IaModelCatalogItem[]
  fetched_at: string
  cached: boolean
  message?: string
}

const IA_MODEL_CATALOG_CACHE_TTL_MS = 15 * 60 * 1000
const iaModelCatalogCache = new Map<string, { at: number; value: IaModelCatalogResult }>()

function makeCatalogCacheKey(provider: IaModelCatalogProvider, cfg?: IaProviderConfig): string {
  const token = cfg?.token?.trim()
  const tokenSignature = token ? `${token.length}:${token.slice(-8)}` : 'no-token'
  return `${provider}:${tokenSignature}`
}

function parsePrice(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0
  return Number.isFinite(n) ? n : 0
}

function mapOpenRouterModels(data: { data?: any[]; models?: any[] }): IaModelCatalogItem[] {
  const rawModels = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : []

  return rawModels
    .map((m) => {
      const prompt = String(m?.pricing?.prompt ?? '0')
      const completion = String(m?.pricing?.completion ?? '0')
      const isFree = parsePrice(prompt) === 0 && parsePrice(completion) === 0
      const supportsTools = Array.isArray(m?.supported_parameters) ? m.supported_parameters.includes('tools') : false
      return {
        id: String(m.id),
        label: m.name ? String(m.name) : String(m.id),
        provider: 'openrouter' as const,
        source: 'api' as const,
        description: typeof m.description === 'string' ? m.description : undefined,
        context_length: Number.isFinite(Number(m.context_length)) ? Number(m.context_length) : undefined,
        pricing: { prompt, completion },
        is_free: isFree,
        supports_tools: supportsTools,
        is_agentic: supportsTools,
        tags: [
          ...(isFree ? ['free'] : []),
          ...(supportsTools ? ['tools', 'agentic'] : []),
        ],
      }
    })
    .sort((a, b) => {
      if (a.is_free && !b.is_free) return -1
      if (!a.is_free && b.is_free) return 1
      if (a.supports_tools && !b.supports_tools) return -1
      if (!a.supports_tools && b.supports_tools) return 1
      return a.label.localeCompare(b.label)
    })
}

function staticGeminiCatalog(): IaModelCatalogResult {
  const models: IaModelCatalogItem[] = [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'gemini', source: 'static', is_agentic: true, supports_tools: true, context_length: 1_048_576, tags: ['flash', 'stable'] },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', provider: 'gemini', source: 'static', is_agentic: true, supports_tools: true, context_length: 1_048_576, tags: ['flash'] },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)', provider: 'gemini', source: 'static', is_agentic: true, supports_tools: true, context_length: 1_048_576, tags: ['flash', 'lite'] },
  ]
  return {
    provider: 'gemini',
    source: 'static',
    models,
    fetched_at: new Date().toISOString(),
    cached: false,
    message: 'Catálogo Gemini estático (fallback). Configure API key para ver todos os modelos.',
  }
}

async function fetchOpenRouterCatalog(): Promise<IaModelCatalogResult> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`)
  }
  const data = await response.json() as { data?: any[] }
  const models = mapOpenRouterModels(data)

  return {
    provider: 'openrouter',
    source: 'api',
    models,
    fetched_at: new Date().toISOString(),
    cached: false,
    message: 'Catálogo em tempo real do OpenRouter com metadados free/tools (agêntico).',
  }
}

async function fetchOpenRouterUserCatalog(token: string): Promise<IaModelCatalogResult> {
  const response = await fetch('https://openrouter.ai/api/v1/models/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`OpenRouter user models API error: ${response.status}`)
  }

  const data = await response.json() as { data?: any[] }
  const models = mapOpenRouterModels(data)

  return {
    provider: 'openrouter',
    source: 'api',
    models,
    fetched_at: new Date().toISOString(),
    cached: false,
    message: 'Catálogo OpenRouter filtrado pela sua conta e pelas políticas atuais.',
  }
}

async function getIaModelCatalog(provider: IaModelCatalogProvider, cfg?: IaProviderConfig, forceRefresh = false): Promise<IaModelCatalogResult> {
  const cacheKey = makeCatalogCacheKey(provider, cfg)
  const now = Date.now()
  const cached = iaModelCatalogCache.get(cacheKey)
  if (!forceRefresh && cached && now - cached.at < IA_MODEL_CATALOG_CACHE_TTL_MS) {
    return { ...cached.value, cached: true }
  }

  let result: IaModelCatalogResult
  if (provider === 'local') {
    const { LOCAL_MODELS } = await import('./ia/local-llm')
    result = {
      provider: 'local',
      source: 'static' as const,
      models: Object.entries(LOCAL_MODELS).map(([id, model]) => ({
        id,
        label: model.label,
        provider: 'local' as const,
        source: 'static' as const,
        description: model.descricao,
        supports_tools: true,
        is_agentic: true,
      })),
      fetched_at: new Date().toISOString(),
      cached: false,
    }
  } else if (provider === 'gemini') {
    if (!isGeminiCloudApiEnabled()) {
      throw new Error('Catálogo Gemini indisponível: API Gemini direta desativada nesta build.')
    }
    // Lista curada — sem fetch dinâmico (evita Nano Banana, Robotics, TTS etc)
    result = staticGeminiCatalog()
  } else {
    const token = cfg?.token?.trim()
    if (token) {
      try {
        result = await fetchOpenRouterUserCatalog(token)
      } catch (error: any) {
        console.warn('[OpenRouter] Falha ao carregar modelos da conta; usando catálogo global:', error?.message)
        const fallback = await fetchOpenRouterCatalog()
        result = {
          ...fallback,
          message: 'Não consegui carregar os modelos da sua conta OpenRouter. Exibindo catálogo global como fallback.',
        }
      }
    } else {
      result = await fetchOpenRouterCatalog()
    }
  }

  iaModelCatalogCache.set(cacheKey, { at: now, value: { ...result, cached: false } })
  return result
}

async function testOpenRouterModel(token: string, modelId: string): Promise<void> {
  await iaTestarConexao('openrouter', token, modelId)
}

// =============================================================================
// IA CONFIGURAÇÃO — HANDLERS
// =============================================================================

const iaConfiguracaoObter = t.procedure
  .action(async () => {
    const config = await queryOne('SELECT * FROM configuracao_ia LIMIT 1')
    return await formatIaConfigForRenderer(config)
  })

const iaCapabilitiesObter = t.procedure
  .action(async () => {
    const config = await queryOne('SELECT * FROM configuracao_ia LIMIT 1')
    return await getIaCapabilities(config)
  })

const iaRoutingObter = t.procedure
  .action(async () => {
    return await getIaRoutingConfig()
  })

const iaRoutingSalvar = t.procedure
  .input<import('@shared/index').AiRoutingConfig>()
  .action(async ({ input }) => {
    return await saveIaRoutingConfig(input)
  })

const iaRoutingStatus = t.procedure
  .input<{ task: import('@shared/index').AiRouteTask; validateLocal?: boolean }>()
  .action(async ({ input }) => {
    return await resolveIaRoute(input.task, { validateLocal: input.validateLocal === true })
  })

const iaRoutingStatusAll = t.procedure
  .input<{ validateLocal?: boolean } | undefined>()
  .action(async ({ input }) => {
    return await resolveAllIaRoutes({ validateLocal: input?.validateLocal === true })
  })

const iaConfiguracaoSalvar = t.procedure
  .input<{ provider: string; api_key: string; modelo: string; provider_configs_json?: string }>()
  .action(async ({ input }) => {
    const existe = await queryOne<{ id: number }>('SELECT id FROM configuracao_ia LIMIT 1')
    const providerConfigsJson = serializeIaProviderConfigs(parseIaProviderConfigs(input.provider_configs_json))
    const previewRow = normalizeIaConfigRow({
      ...(existe ? await queryOne('SELECT * FROM configuracao_ia LIMIT 1') : {}),
      provider: input.provider,
      api_key: input.api_key,
      modelo: input.modelo,
      provider_configs_json: providerConfigsJson,
    })
    const previewCapabilities = await getIaCapabilities(previewRow)
    const ativo = previewCapabilities.active_provider_available

    if (existe) {
      await execute(`UPDATE configuracao_ia SET provider = ?, api_key = ?, modelo = ?, provider_configs_json = ?, ativo = ?, atualizado_em = NOW() WHERE id = ?`,
        input.provider, input.api_key, input.modelo, providerConfigsJson, ativo, existe.id)
    } else {
      await execute(`INSERT INTO configuracao_ia (provider, api_key, modelo, provider_configs_json, ativo) VALUES (?, ?, ?, ?, ?)`,
        input.provider, input.api_key, input.modelo, providerConfigsJson, ativo)
    }

    return await formatIaConfigForRenderer(await queryOne('SELECT * FROM configuracao_ia LIMIT 1'))
  })

const iaConfiguracaoTestar = t.procedure
  .input<{ provider: string; api_key: string; modelo: string; provider_configs_json?: string }>()
  .action(async ({ input }) => {
    try {
      if (input.provider === 'local') {
        const { getLocalStatus, validateLocalModel } = await import('./ia/local-llm')
        const modelId = input.modelo as import('./ia/local-llm').LocalModelId
        const statusBefore = getLocalStatus()
        const modelBefore = statusBefore.modelos[modelId]
        if (!modelBefore?.baixado) {
          throw new Error('Modelo local não baixado. Clique em Baixar e aguarde a conclusão antes de testar.')
        }
        const validated = await validateLocalModel(modelId)
        if (!validated.usable) {
          throw new Error(validated.load_error || 'Modelo local não passou na validação de carregamento.')
        }
        const status = getLocalStatus()
        return { sucesso: true, mensagem: `Modelo local carregou com sucesso. GPU: ${status.gpu_detectada || 'cpu'}` }
      }

      if (input.provider === 'openrouter') {
        const providerConfigs = parseIaProviderConfigs(input.provider_configs_json)
        const providerCfg = providerConfigs.openrouter
        if (!providerCfg?.token?.trim()) {
          throw new Error('Token/OpenRouter API Key não configurado.')
        }
        const ping = await iaTestarConexao('openrouter', providerCfg.token.trim(), input.modelo)
        const catalog = await getIaModelCatalog('openrouter', providerCfg, true)
        return {
          sucesso: true,
          mensagem: `${ping.mensagem} · Catálogo: ${catalog.models.length} modelos`,
          detalhes: { ping, catalog },
        }
      }

      return await iaTestarConexao(input.provider, input.api_key, input.modelo)
    } catch (error: any) {
      throw new Error(error.message || 'Erro desconhecido ao testar conexão.')
    }
  })

const iaModelosCatalogo = t.procedure
  .input<{ provider: IaModelCatalogProvider; provider_config?: IaProviderConfig; force_refresh?: boolean }>()
  .action(async ({ input }) => {
    return await getIaModelCatalog(input.provider, input.provider_config, Boolean(input.force_refresh))
  })

const iaOpenRouterTestarGratuitos = t.procedure
  .input<{ provider_config?: IaProviderConfig; model_ids?: string[] }>()
  .action(async ({ input }) => {
    const token = input.provider_config?.token?.trim()
    if (!token) {
      throw new Error('Token/OpenRouter API Key não configurado.')
    }

    const catalog = await getIaModelCatalog('openrouter', input.provider_config, true)
    const requestedIds = new Set((input.model_ids ?? []).filter(Boolean))
    const freeModels = catalog.models.filter((model) => (
      model.is_free
      && model.id !== OPENROUTER_FREE_ROUTER_MODEL
      && (requestedIds.size === 0 || requestedIds.has(model.id))
    ))

    if (freeModels.length === 0) {
      return {
        total_models: catalog.models.length,
        tested_models: 0,
        success_count: 0,
        successful_model_ids: [],
        failed_models: [],
      } satisfies import('@shared/index').IaOpenRouterFreeModelsTestResult
    }

    const queue = [...freeModels]
    const results: Array<{ id: string; ok: boolean; error?: string }> = []
    const concurrency = Math.min(4, freeModels.length)

    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (queue.length > 0) {
          const nextModel = queue.shift()
          if (!nextModel) return

          try {
            await testOpenRouterModel(token, nextModel.id)
            results.push({ id: nextModel.id, ok: true })
          } catch (error: any) {
            results.push({
              id: nextModel.id,
              ok: false,
              error: error?.message || 'Erro desconhecido ao testar modelo.',
            })
          }
        }
      })
    )

    const successfulModelIds = freeModels
      .map((model) => model.id)
      .filter((id) => results.some((result) => result.id === id && result.ok))

    const failedModels = freeModels
      .map((model) => {
        const result = results.find((entry) => entry.id === model.id && !entry.ok)
        return result ? { id: model.id, error: result.error || 'Erro desconhecido ao testar modelo.' } : null
      })
      .filter((entry): entry is { id: string; error: string } => Boolean(entry))

    return {
      total_models: catalog.models.length,
      tested_models: freeModels.length,
      success_count: successfulModelIds.length,
      successful_model_ids: successfulModelIds,
      failed_models: failedModels,
    } satisfies import('@shared/index').IaOpenRouterFreeModelsTestResult
  })

// ---------------------------------------------------------------------------
// IA LOCAL — download, lifecycle, status
// ---------------------------------------------------------------------------

const iaLocalStatus = t.procedure
  .action(async () => {
    const { getLocalStatus } = await import('./ia/local-llm')
    return getLocalStatus()
  })

const iaLocalModels = t.procedure
  .action(async () => {
    const { LOCAL_MODELS, getLocalStatus } = await import('./ia/local-llm')
    const status = getLocalStatus()
    return Object.entries(LOCAL_MODELS).map(([id, m]) => ({
      id,
      label: m.label,
      filename: m.filename,
      size_bytes: m.size_bytes,
      ram_minima_gb: m.ram_minima_gb,
      descricao: m.descricao,
      baixado: status.modelos[id]?.baixado ?? false,
      usable: status.modelos[id]?.usable ?? false,
      requires_validation: status.modelos[id]?.requires_validation ?? false,
      load_error: status.modelos[id]?.load_error,
      validated_at: status.modelos[id]?.validated_at,
      tamanho_atual_bytes: status.modelos[id]?.tamanho_atual_bytes,
      download_status: status.modelos[id]?.download_status,
      download_progresso: status.modelos[id]?.download_progresso,
      download_bytes_total: status.modelos[id]?.download_bytes_total,
      download_bytes_feitos: status.modelos[id]?.download_bytes_feitos,
      download_error: status.modelos[id]?.download_error,
    }))
  })

const iaLocalDownload = t.procedure
  .input<{ model_id: string }>()
  .action(async ({ input }) => {
    const { downloadModel, validateLocalModel } = await import('./ia/local-llm')
    const modelId = input.model_id as import('./ia/local-llm').LocalModelId
    await downloadModel(modelId, (downloaded, total) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('ia:local:download-progress', { model_id: modelId, downloaded, total })
      }
    })
    // Auto-valida ao terminar o download: 1o boot sem clique manual em "Testar
    // conexao". Best-effort — se a validacao falhar, o download em si teve
    // sucesso, entao logamos e NAO derrubamos o resultado. (validateLocalModel
    // ja grava o erro no estado do modelo antes de lançar, entao a readiness
    // resolve como local_model_error e a UI orienta baixar de novo / trocar IA.)
    try {
      await validateLocalModel(modelId)
    } catch (err) {
      console.warn(`[LOCAL-LLM] Auto-validacao pos-download falhou para ${modelId}:`, err)
    }
    return { sucesso: true }
  })

const iaLocalCancelDownload = t.procedure
  .action(async () => {
    const { cancelDownload } = await import('./ia/local-llm')
    cancelDownload()
    return { sucesso: true }
  })

const iaLocalDeleteModel = t.procedure
  .input<{ model_id: string }>()
  .action(async ({ input }) => {
    const { unloadModel, deleteModel } = await import('./ia/local-llm')
    await unloadModel()
    deleteModel(input.model_id as import('./ia/local-llm').LocalModelId)
    return { sucesso: true }
  })

const iaLocalUnload = t.procedure
  .action(async () => {
    const { unloadModel } = await import('./ia/local-llm')
    await unloadModel()
    return { sucesso: true }
  })

const iaSttStatus = t.procedure
  .action(async () => {
    const { getSttStatus } = await import('./stt/download')
    return getSttStatus()
  })

const iaSttModels = t.procedure
  .action(async () => {
    const { getSttStatus } = await import('./stt/download')
    return getSttStatus()
  })

const iaSttDownload = t.procedure
  .input<{ model_id: import('@shared/index').SttModelId }>()
  .action(async ({ input }) => {
    const { downloadSttModel } = await import('./stt/download')
    await downloadSttModel(input.model_id)
    return { sucesso: true }
  })

const iaSttDeleteModel = t.procedure
  .input<{ model_id: import('@shared/index').SttModelId }>()
  .action(async ({ input }) => {
    const { deleteSttModel } = await import('./stt/download')
    deleteSttModel(input.model_id)
    return { sucesso: true }
  })

const iaSttTranscribe = t.procedure
  .input<{
    wav_base64: string
    model_id?: import('@shared/index').SttModelId
    post_process?: boolean
    post_process_mode?: 'clean_prompt' | 'formal_message'
  }>()
  .action(async ({ input }) => {
    const { transcribeWavBase64 } = await import('./stt/download')
    return transcribeWavBase64(input)
  })

// =============================================================================
// IA CHAT
// =============================================================================

const iaChatLerArquivo = t.procedure
  .input<{ conversa_id: string }>()
  .action(async ({ input }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('Nenhuma janela ativa')
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Imagens e Documentos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf', 'txt', 'md', 'json'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const buf = readFileSync(filePath)
    if (buf.length > 10 * 1024 * 1024) throw new Error('Arquivo excede 10 MB')
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
      '.json': 'application/json',
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    const id = crypto.randomUUID()
    // Salvar em disco
    const dir = getAnexosConversaDir(input.conversa_id)
    const destExt = mimeToExt(mime)
    const destPath = path.join(dir, `${id}${destExt}`)
    writeFileSync(destPath, buf)
    return {
      id,
      data_base64: buf.toString('base64'),
      mime_type: mime,
      nome: path.basename(filePath),
      tamanho_bytes: buf.length,
      file_path: destPath,
    }
  })

// Salvar anexo vindo do renderer (drag & drop, paste) em disco
const iaChatSalvarAnexo = t.procedure
  .input<{ conversa_id: string; id: string; data_base64: string; mime_type: string; nome: string; tamanho_bytes: number }>()
  .action(async ({ input }) => {
    const dir = getAnexosConversaDir(input.conversa_id)
    const ext = mimeToExt(input.mime_type)
    const destPath = path.join(dir, `${input.id}${ext}`)
    const buf = Buffer.from(input.data_base64, 'base64')
    writeFileSync(destPath, buf)
    return { file_path: destPath }
  })

// Ler anexo do disco pra preview (ao recarregar histórico)
const iaChatLerAnexoPreview = t.procedure
  .input<{ file_path: string }>()
  .action(async ({ input }) => {
    if (!existsSync(input.file_path)) return null
    const buf = readFileSync(input.file_path)
    return { data_base64: buf.toString('base64') }
  })

const iaChatEnviar = t.procedure
  .input<{ mensagem: string; historico: import('@shared/index').IaMensagem[]; contexto?: import('@shared/index').IaContexto; stream_id?: string; conversa_id?: string; anexos?: import('@shared/index').IaAnexo[] }>()
  .action(async ({ input }) => {
    if (input.stream_id) {
      return await iaEnviarMensagemStream(input.mensagem, input.historico, input.stream_id, input.contexto, input.conversa_id, input.anexos)
    }
    return await iaEnviarMensagem(input.mensagem, input.historico, input.contexto, input.conversa_id, input.anexos)
  })

// =============================================================================
// IA HISTÓRICO DE CONVERSAS
// =============================================================================

const iaConversasListar = t.procedure
  .input<{ status?: string; busca?: string }>()
  .action(async ({ input }) => {
    const status = input.status ?? 'ativo'
    const busca = input.busca ? `%${input.busca}%` : '%'
    return await queryAll<import('@shared/index').IaConversa>(
      `SELECT * FROM ia_conversas WHERE status = ? AND titulo LIKE ? ORDER BY atualizado_em DESC`,
      status, busca)
  })

const iaConversasObter = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const conversa = await queryOne<import('@shared/index').IaConversa>(
      `SELECT * FROM ia_conversas WHERE id = ?`, input.id)
    if (!conversa) throw new Error('Conversa não encontrada')

    // FASE 4: Carregar tool_calls_json e deserializar
    const mensagensRaw = await queryAll<{
      id: string
      conversa_id: string
      papel: string
      conteudo: string
      timestamp: string
      tool_calls_json: string | null
      anexos_meta_json: string | null
    }>(
      `SELECT id, conversa_id, papel, conteudo, timestamp, tool_calls_json, anexos_meta_json FROM ia_mensagens WHERE conversa_id = ? ORDER BY timestamp ASC`,
      input.id)

    const mensagens: import('@shared/index').IaMensagem[] = mensagensRaw.map((m) => ({
      id: m.id,
      conversa_id: m.conversa_id,
      papel: m.papel as import('@shared/index').IaMensagem['papel'],
      conteudo: m.conteudo,
      timestamp: m.timestamp,
      tool_calls: m.tool_calls_json
        ? safeJsonParse(m.tool_calls_json)
        : undefined,
      anexos: m.anexos_meta_json
        ? safeJsonParse(m.anexos_meta_json)
        : undefined,
    }))

    return { conversa, mensagens }
  })

const iaConversasCriar = t.procedure
  .input<{ id?: string; titulo?: string }>()
  .action(async ({ input }) => {
    const id = input.id ?? crypto.randomUUID()
    const titulo = input.titulo ?? 'Nova conversa'
    await execute(`INSERT INTO ia_conversas (id, titulo) VALUES (?, ?)`, id, titulo)
    return await queryOne<import('@shared/index').IaConversa>(
      `SELECT * FROM ia_conversas WHERE id = ?`, id) as import('@shared/index').IaConversa
  })

const iaConversasRenomear = t.procedure
  .input<{ id: string; titulo: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET titulo = ?, atualizado_em = NOW() WHERE id = ?`,
      input.titulo, input.id)
  })

const iaConversasArquivar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE id = ?`,
      input.id)
    await limparAnexosConversa(input.id)
  })

const iaConversasRestaurar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'ativo', atualizado_em = NOW() WHERE id = ?`,
      input.id)
  })

const iaConversasDeletar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await limparAnexosConversa(input.id)
    await execute(`DELETE FROM ia_conversas WHERE id = ?`, input.id)
  })

const iaMensagensSalvar = t.procedure
  .input<{ conversa_id: string; mensagem: import('@shared/index').IaMensagem }>()
  .action(async ({ input }) => {
    const { conversa_id, mensagem } = input

    // FASE 4: Serializar tool_calls se existir
    const toolCallsJson = mensagem.tool_calls
      ? JSON.stringify(mensagem.tool_calls)
      : null

    const anexosMetaJson = mensagem.anexos && mensagem.anexos.length > 0
      ? JSON.stringify(mensagem.anexos.map(a => ({ id: a.id, tipo: a.tipo, mime_type: a.mime_type, nome: a.nome, tamanho_bytes: a.tamanho_bytes, file_path: a.file_path })))
      : null

    await execute(
      `INSERT INTO ia_mensagens (id, conversa_id, papel, conteudo, timestamp, tool_calls_json, anexos_meta_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      mensagem.id,
      conversa_id,
      mensagem.papel,
      mensagem.conteudo,
      mensagem.timestamp,
      toolCallsJson,
      anexosMetaJson
    )
    // Invalidar cache de compaction (nova msg muda o historico)
    await execute(
      `UPDATE ia_conversas SET atualizado_em = NOW(), resumo_compactado = NULL WHERE id = ?`,
      conversa_id)
  })

const iaConversasArquivarTodas = t.procedure.action(async () => {
  // Busca IDs ativas ANTES de arquivar (pra limpar anexos)
  const ativas = await queryAll<{ id: string }>(
    `SELECT id FROM ia_conversas WHERE status = 'ativo'`)
  await execute(
    `UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE status = 'ativo'`)
  for (const c of ativas) {
    await limparAnexosConversa(c.id)
  }
})

const iaConversasDeletarArquivadas = t.procedure.action(async () => {
  await limparAnexosArquivadas()
  await execute(`DELETE FROM ia_conversas WHERE status = 'arquivado'`)
})

// =============================================================================
// IA MENSAGENS — Edit + Export
// =============================================================================

const iaMensagensAtualizar = t.procedure
  .input<{ id: string; conteudo: string }>()
  .action(async ({ input }) => {
    await execute('UPDATE ia_mensagens SET conteudo = ? WHERE id = ?', input.conteudo, input.id)
    return { ok: true }
  })

const iaMensagensDeletarApos = t.procedure
  .input<{ conversa_id: string; timestamp: string }>()
  .action(async ({ input }) => {
    await execute(
      'DELETE FROM ia_mensagens WHERE conversa_id = ? AND timestamp > ?',
      input.conversa_id,
      input.timestamp,
    )
    // Invalida compaction (edicao muda historico)
    await execute(
      'UPDATE ia_conversas SET resumo_compactado = NULL WHERE id = ?',
      input.conversa_id,
    )
    return { ok: true }
  })

const iaConversasExportar = t.procedure
  .input<{ conversa_id: string; formato: 'md' | 'json' }>()
  .action(async ({ input }) => {
    const { dialog } = await import('electron')
    const { writeFile } = await import('node:fs/promises')

    const msgs = await queryAll<{
      papel: string; conteudo: string; timestamp: string
      tool_calls_json: string | null; anexos_meta_json: string | null
    }>(
      'SELECT papel, conteudo, timestamp, tool_calls_json, anexos_meta_json FROM ia_mensagens WHERE conversa_id = ? ORDER BY timestamp',
      input.conversa_id,
    )
    const conversa = await queryOne<{ titulo: string }>(
      'SELECT titulo FROM ia_conversas WHERE id = ?',
      input.conversa_id,
    )
    const titulo = conversa?.titulo ?? 'Chat IA'

    const mensagens = msgs.map(m => ({
      ...m,
      tool_calls: m.tool_calls_json ? safeJsonParse<{ name: string; args?: unknown }[]>(m.tool_calls_json) : undefined,
      anexos: m.anexos_meta_json ? safeJsonParse<{ nome: string; mime_type: string }[]>(m.anexos_meta_json) : undefined,
    }))

    let content: string
    let ext: string
    if (input.formato === 'json') {
      content = JSON.stringify({ titulo, exportado_em: new Date().toISOString(), mensagens }, null, 2)
      ext = 'json'
    } else {
      // Gera markdown inline (sem importar do renderer)
      const lines: string[] = [`# ${titulo}`, `*Exportado em ${new Date().toLocaleString('pt-BR')}*`, '']
      for (const m of mensagens) {
        if (m.papel === 'tool_result') continue
        lines.push(`### ${m.papel === 'usuario' ? '**Voce**' : '**IA**'}`)
        lines.push(m.conteudo)
        if (m.tool_calls?.length) {
          lines.push('', '<details><summary>Ferramentas utilizadas</summary>', '')
          for (const tc of m.tool_calls) {
            lines.push(`- **${tc.name}**${tc.args ? `: \`${JSON.stringify(tc.args)}\`` : ''}`)
          }
          lines.push('</details>')
        }
        if (m.anexos?.length) {
          lines.push('')
          for (const a of m.anexos) lines.push(`> Anexo: ${a.nome} (${a.mime_type})`)
        }
        lines.push('', '---', '')
      }
      content = lines.join('\n')
      ext = 'md'
    }

    const slug = titulo.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    const { filePath } = await dialog.showSaveDialog({
      title: 'Exportar conversa',
      defaultPath: `flowkit-chat-${slug}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    })

    if (filePath) {
      await writeFile(filePath, content, 'utf-8')
      return { exportado: true, caminho: filePath }
    }
    return { exportado: false }
  })

// =============================================================================
// IA SESSION PROCESSING — Phase 5
// =============================================================================

const iaSessaoProcessar = t.procedure
  .input<{ conversa_id: string }>()
  .action(async ({ input }) => {
    const { extractMemories, indexSession } = await import('./ia/session-processor')

    // Carrega conversa + mensagens (nao depende de config IA)
    const conversa = await queryOne<{ id: string; titulo: string }>(
      'SELECT id, titulo FROM ia_conversas WHERE id = ?', input.conversa_id)
    if (!conversa) return { ok: true }

    const mensagensRaw = await queryAll<{
      id: string; conversa_id: string; papel: string; conteudo: string; timestamp: string
    }>(
      'SELECT id, conversa_id, papel, conteudo, timestamp FROM ia_mensagens WHERE conversa_id = ? ORDER BY timestamp ASC',
      input.conversa_id)

    if (mensagensRaw.length < 2) return { ok: true }

    const mensagens: import('@shared/index').IaMensagem[] = mensagensRaw.map((m) => ({
      id: m.id,
      papel: m.papel as import('@shared/index').IaMensagem['papel'],
      conteudo: m.conteudo,
      timestamp: m.timestamp,
    }))

    // 1. Session Indexing — SEMPRE roda (embedding local, gratis)
    try {
      await indexSession(input.conversa_id, conversa.titulo, mensagens)
    } catch (err) {
      console.warn('[Session] indexSession falhou:', (err as Error).message)
    }

    // 2. Smart Extraction — so se toggle ON + API configurada (pago)
    const config = await queryOne<import('@shared/index').IaConfiguracao>(
      'SELECT * FROM configuracao_ia LIMIT 1')
    if (config?.memoria_automatica) {
      const { buildModelFactory } = await import('./ia/config')
      const factory = buildModelFactory(config)
      if (factory) {
        try {
          await extractMemories(input.conversa_id, mensagens, factory.createModel, factory.modelo)
        } catch (err) {
          console.warn('[Session] extractMemories falhou:', (err as Error).message)
        }
      }
    }

    return { ok: true }
  })

const iaConfigMemoriaAutomatica = t.procedure
  .input<{ valor?: boolean }>()
  .action(async ({ input }) => {
    if (input.valor !== undefined) {
      await execute(
        'UPDATE configuracao_ia SET memoria_automatica = ? WHERE id = 1',
        input.valor)
    }
    const config = await queryOne<{ memoria_automatica: boolean }>(
      'SELECT memoria_automatica FROM configuracao_ia LIMIT 1')
    return { memoria_automatica: config?.memoria_automatica ?? true }
  })

// =============================================================================
// IA MEMÓRIAS (4 handlers)
// =============================================================================

const IA_MEMORIAS_LIMIT = 50

const iaMemoriasListar = t.procedure.action(async () => {
  return await queryAll<import('@shared/index').IaMemoria>(
    'SELECT * FROM ia_memorias ORDER BY atualizada_em DESC')
})

const iaMemoriasSalvar = t.procedure
  .input<{ id?: number; conteudo: string }>()
  .action(async ({ input }) => {
    // Gera embedding local (grátis, ONNX)
    let embeddingStr: string | null = null
    try {
      const { generateQueryEmbedding } = await import('./knowledge/embeddings')
      const emb = await generateQueryEmbedding(input.conteudo)
      if (emb) embeddingStr = `[${emb.join(',')}]`
    } catch { /* embedding opcional — continua sem */ }

    if (input.id) {
      if (embeddingStr) {
        await execute(
          'UPDATE ia_memorias SET conteudo = $1, embedding = $2::vector, atualizada_em = NOW() WHERE id = $3',
          input.conteudo, embeddingStr, input.id)
      } else {
        await execute(
          'UPDATE ia_memorias SET conteudo = $1, atualizada_em = NOW() WHERE id = $2',
          input.conteudo, input.id)
      }
      return await queryOne<import('@shared/index').IaMemoria>(
        'SELECT * FROM ia_memorias WHERE id = $1', input.id)
    }
    // Soft limit
    const countRow = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
    if ((countRow?.c ?? 0) >= IA_MEMORIAS_LIMIT) {
      throw new Error(`Limite de ${IA_MEMORIAS_LIMIT} memórias atingido. Remova uma antes de adicionar.`)
    }
    const id = embeddingStr
      ? await insertReturningId(
          `INSERT INTO ia_memorias (conteudo, origem, embedding) VALUES ($1, 'manual', $2::vector)`,
          input.conteudo, embeddingStr)
      : await insertReturningId(
          `INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'manual')`,
          input.conteudo)
    return await queryOne<import('@shared/index').IaMemoria>(
      'SELECT * FROM ia_memorias WHERE id = $1', id)
  })

const iaMemoriasRemover = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
    await execute('DELETE FROM ia_memorias WHERE id = $1', input.id)
  })

const iaMemoriasContar = t.procedure.action(async () => {
  const row = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
  return { total: row?.c ?? 0, limite: IA_MEMORIAS_LIMIT }
})

// =============================================================================
// KNOWLEDGE
// =============================================================================

const knowledgeListarFontes = t.procedure.action(async () => {
  return await queryAll<{
    id: number
    tipo: string
    titulo: string
    importance: string
    criada_em: string
    atualizada_em: string
  }>('SELECT id, tipo, titulo, importance, criada_em, atualizada_em FROM knowledge_sources ORDER BY atualizada_em DESC')
})

const knowledgeStats = t.procedure.action(async () => {
  const fontes = await queryAll<{
    id: number
    tipo: string
    titulo: string
    importance: string
    ativo: boolean
    criada_em: string
    atualizada_em: string
    chunks_count: number
  }>(`
    SELECT ks.id, ks.tipo, ks.titulo, ks.importance, ks.ativo, ks.criada_em, ks.atualizada_em,
           COUNT(kc.id)::int as chunks_count
    FROM knowledge_sources ks
    LEFT JOIN knowledge_chunks kc ON kc.source_id = ks.id
    GROUP BY ks.id
    ORDER BY ks.atualizada_em DESC
  `)

  const totais = await queryOne<{
    total_fontes: number
    total_chunks: number
    total_sistema: number
    total_usuario: number
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_sources) as total_fontes,
      (SELECT COUNT(*)::int FROM knowledge_chunks) as total_chunks,
      (SELECT COUNT(*)::int FROM knowledge_sources WHERE tipo = 'sistema') as total_sistema,
      (SELECT COUNT(*)::int FROM knowledge_sources WHERE tipo != 'sistema') as total_usuario
  `)

  const enrichment = await queryOne<{
    enriched_count: number
    pending_count: number
    last_enriched_at: string | null
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE enriched_at IS NOT NULL) as enriched_count,
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE enriched_at IS NULL) as pending_count,
      (SELECT MAX(enriched_at)::text FROM knowledge_chunks) as last_enriched_at
  `)

  return {
    fontes,
    totais: totais ?? { total_fontes: 0, total_chunks: 0, total_sistema: 0, total_usuario: 0 },
    enrichment: enrichment ?? { enriched_count: 0, pending_count: 0, last_enriched_at: null },
  }
})

const knowledgeEscolherArquivo = t.procedure.action(async () => {
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    properties: ['openFile' as const],
    filters: [{ name: 'Documentos', extensions: ['md', 'markdown', 'txt', 'pdf', 'json', 'zip', 'html', 'htm', 'csv'] }],
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

const knowledgeEscolherPasta = t.procedure.action(async () => {
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    properties: ['openDirectory' as const],
    title: 'Escolher pasta para importar no RAG',
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

const knowledgeBulkImportStart = t.procedure
  .input<import('@shared/index').BulkRagImportInput>()
  .action(async ({ input }) => {
    const { startBulkRagImport } = await import('./knowledge/bulk-import')
    return startBulkRagImport(input)
  })

const knowledgeImportar = t.procedure
  .input<{ caminho_arquivo: string }>()
  .action(async ({ input }) => {
  const fs = require('node:fs') as typeof import('node:fs')
  const p = require('node:path') as typeof import('node:path')
  const { ingestKnowledge } = await import('./knowledge/ingest')

  if (!fs.existsSync(input.caminho_arquivo)) {
    throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
  }

  const conteudo = fs.readFileSync(input.caminho_arquivo, 'utf-8')
  const titulo = p.basename(input.caminho_arquivo, p.extname(input.caminho_arquivo))
  const result = await ingestKnowledge(titulo, conteudo, 'high', {
    tipo: 'importacao_usuario',
    arquivo_original: input.caminho_arquivo,
  })

  // Fire-and-forget: enriquece chunks novos em background
  void autoEnrichAfterIngest()

  return result
})

const knowledgeRemoverFonte = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
  await execute('DELETE FROM knowledge_sources WHERE id = $1', input.id)
  return { ok: true }
})

const knowledgeToggleAtivo = t.procedure
  .input<{ id: number; ativo: boolean }>()
  .action(async ({ input }) => {
  await execute(
    'UPDATE knowledge_sources SET ativo = $1, atualizada_em = NOW() WHERE id = $2',
    input.ativo,
    input.id,
  )
  return { ok: true }
})

const knowledgeObterTextoOriginal = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
  const row = await queryOne<{
    titulo: string
    conteudo_original: string
    metadata: string
  }>(
    'SELECT titulo, conteudo_original, metadata::text as metadata FROM knowledge_sources WHERE id = $1',
    input.id,
  )
  if (!row) throw new Error('Fonte não encontrada')
  let context_hint: string | null = null
  try {
    const meta = JSON.parse(row.metadata)
    context_hint = meta?.context_hint ?? null
  } catch { /* ok */ }
  return { titulo: row.titulo, conteudo_original: row.conteudo_original, context_hint }
})

const knowledgeExtrairTexto = t.procedure
  .input<{ caminho_arquivo: string }>()
  .action(async ({ input }) => {
  const fs = require('node:fs') as typeof import('node:fs')
  const p = require('node:path') as typeof import('node:path')

  if (!fs.existsSync(input.caminho_arquivo)) {
    throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
  }

  const ext = p.extname(input.caminho_arquivo).toLowerCase()
  const nome_arquivo = p.basename(input.caminho_arquivo, ext)

  const { importFile } = await import('./importers/importer-registry')
  const result = await importFile(input.caminho_arquivo)

  if (result.type === 'error') {
    throw new Error(result.error)
  }

  if (result.type === 'conversations') {
    const count = result.data.conversations.length
    const preview = result.data.conversations
      .slice(0, 5)
      .map(c => `- ${c.title} (${c.messages.length} msgs)`)
      .join('\n')
    const texto = `${count} conversa(s) encontrada(s):\n\n${preview}${count > 5 ? `\n... e mais ${count - 5}` : ''}`
    return { texto, nome_arquivo, tipo: 'conversations' as const, conversation_count: count }
  }

  // text result (PDF, .md, .txt, plain JSON, etc.)
  return { texto: result.data.text, nome_arquivo, tipo: 'text' as const }
})

const knowledgeImportarArquivo = t.procedure
  .input<{ caminho_arquivo: string; titulo?: string }>()
  .action(async ({ input }) => {
    const fs = require('node:fs') as typeof import('node:fs')

    if (!fs.existsSync(input.caminho_arquivo)) {
      throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
    }

    const { ingestFromFile } = await import('./knowledge/ingest')
    const result = await ingestFromFile(input.caminho_arquivo, input.titulo)

    // Fire-and-forget: enriquece chunks novos em background
    void autoEnrichAfterIngest()

    return result
  })

const metadataIaCache = new Map<string, {
  expiresAt: number
  promise: Promise<{ titulo: string; quando_consultar: string }>
}>()
const METADATA_IA_CACHE_TTL_MS = 30_000

async function gerarMetadataIaCached(texto: string): Promise<{ titulo: string; quando_consultar: string }> {
  // Fingerprint the resolved route so changing provider/model invalidates the cache
  // (otherwise a regenerate within the TTL could return output from a now-stale route).
  const { resolveIaRoute } = await import('./ia/routing')
  const route = await resolveIaRoute('rag_metadata', { validateLocal: false })
  const routeKey = `${route.provider ?? 'none'}:${route.model ?? 'none'}`
  const key = `${routeKey}|${texto.length}:${texto.slice(0, 512)}:${texto.slice(-512)}`
  const now = Date.now()
  const cached = metadataIaCache.get(key)
  if (cached && cached.expiresAt > now) return cached.promise

  const promise = import('./ia/metadata-generator')
    .then(({ generateRagMetadata }) => generateRagMetadata({
      texto,
      fileNameFallback: 'Documento importado',
    }))
    .then(({ titulo, quando_consultar }) => ({ titulo, quando_consultar }))

  metadataIaCache.set(key, { expiresAt: now + METADATA_IA_CACHE_TTL_MS, promise })
  promise.catch(() => metadataIaCache.delete(key))
  setTimeout(() => {
    if (metadataIaCache.get(key)?.promise === promise) metadataIaCache.delete(key)
  }, METADATA_IA_CACHE_TTL_MS).unref?.()

  return promise
}

const knowledgeGerarMetadataIa = t.procedure
  .input<{ texto: string; campo: 'titulo' | 'quando_consultar' | 'texto' }>()
  .action(async ({ input }) => {
  const { generateRagTextCorrection } = await import('./ia/metadata-generator')

  if (input.campo === 'texto') {
    const result = await generateRagTextCorrection(input.texto)
    return { resultado: result.resultado }
  }

  const result = await gerarMetadataIaCached(input.texto)

  return { resultado: result[input.campo] }
})

const knowledgeImportarCompleto = t.procedure
  .input<{ titulo: string; conteudo: string; quando_consultar: string }>()
  .action(async ({ input }) => {
  const { ingestKnowledge } = await import('./knowledge/ingest')

  // Prepend context hint como HTML comment
  const conteudoComHint = input.quando_consultar
    ? `<!-- quando_usar: ${input.quando_consultar} -->\n${input.conteudo}`
    : input.conteudo

  const result = await ingestKnowledge(input.titulo, conteudoComHint, 'high', {
    tipo: 'manual',
    context_hint: input.quando_consultar,
  })

  // Fire-and-forget: enriquece chunks novos em background
  void autoEnrichAfterIngest()

  return result
})

// =============================================================================
// KNOWLEDGE ENRICHMENT — Auto-enrich (fire-and-forget after ingest)
// =============================================================================

async function autoEnrichAfterIngest(): Promise<void> {
  try {
    const { getKnowledgeEnrichmentConfig, buildKnowledgeEnrichmentModel } = await import('./knowledge/enrichment-config')
    const { enrichAllChunksWithModel } = await import('./knowledge/enrichment')
    const enrichmentConfig = await getKnowledgeEnrichmentConfig()
    if (!enrichmentConfig.auto_enrich_after_import) return

    const model = await buildKnowledgeEnrichmentModel(enrichmentConfig)
    if (!model) return

    const result = await enrichAllChunksWithModel(model)
    if (result.chunks_enriquecidos > 0) {
      console.log(`[auto-enrich] ${result.chunks_enriquecidos} chunks enriquecidos em background com ${result.provider}/${result.modelo}`)
    }
  } catch (err) {
    console.warn('[auto-enrich] falhou (non-blocking):', (err as Error).message)
  }
}

// =============================================================================
// KNOWLEDGE ENRICHMENT — Self-RAG (manual trigger)
// =============================================================================

const knowledgeEnrich = t.procedure
  .input<{ sourceTipo?: string; bulkGroupId?: string; forceAll?: boolean }>()
  .action(async ({ input }) => {
    const { enrichAllChunksWithModel } = await import('./knowledge/enrichment')
    const { getKnowledgeEnrichmentConfig, buildKnowledgeEnrichmentModel } = await import('./knowledge/enrichment-config')

    const config = await getKnowledgeEnrichmentConfig()
    const model = await buildKnowledgeEnrichmentModel(config)
    if (!model) throw new Error('Nenhum modelo disponível para enriquecimento de chunks.')

    const result = await enrichAllChunksWithModel(model, {
      sourceTipo: input?.sourceTipo,
      bulkGroupId: input?.bulkGroupId,
      forceAll: input?.forceAll ?? config.force_all_default,
    })
    return result
  })

const knowledgeEnrichmentConfigGet = t.procedure.action(async () => {
  const { getKnowledgeEnrichmentConfig } = await import('./knowledge/enrichment-config')
  return await getKnowledgeEnrichmentConfig()
})

const knowledgeEnrichmentConfigSave = t.procedure
  .input<Partial<import('@shared/index').KnowledgeEnrichmentConfig>>()
  .action(async ({ input }) => {
    const { saveKnowledgeEnrichmentConfig } = await import('./knowledge/enrichment-config')
    return await saveKnowledgeEnrichmentConfig(input)
  })

const knowledgeEnrichmentModelsList = t.procedure.action(async () => {
  const { listKnowledgeEnrichmentModelOptions } = await import('./knowledge/enrichment-config')
  return await listKnowledgeEnrichmentModelOptions()
})

// =============================================================================
// KNOWLEDGE GRAPH — Fase 6
// =============================================================================

const knowledgeRebuildGraph = t.procedure
  .input<{ origem?: 'sistema' | 'usuario' }>()
  .action(async ({ input }) => {
    const { rebuildGraph } = await import('./knowledge/graph')
    const { buildModelFactory } = await import('./ia/config')

    const config = await requireCloudLlmFeature('Rebuild do knowledge graph') as import('@shared/index').IaConfiguracao

    const factory = buildModelFactory(config)
    if (!factory) throw new Error('Provider cloud inválido para rebuild do knowledge graph.')

    const origem = input?.origem ?? 'usuario'
    const result = await rebuildGraph(factory.createModel, factory.modelo, origem)
    return result
  })

const knowledgeGraphStats = t.procedure
  .input<{ origem?: 'sistema' | 'usuario' }>()
  .action(async ({ input }) => {
    const { graphStats } = await import('./knowledge/graph')
    return await graphStats(input?.origem)
  })

/**
 * DEV-ONLY: Rebuild graph do sistema (LLM) + export seed JSON.
 * O JSON gerado é commitado no repo e usado pelo seed em produção (sem LLM).
 */
const knowledgeRebuildAndExportSistema = t.procedure.action(async () => {
  if (process.env.NODE_ENV !== 'development' && !process.argv.includes('--dev')) {
    throw new Error('rebuildAndExportSistema so pode ser executado em modo development')
  }

  const { rebuildGraph, exportGraphSeed } = await import('./knowledge/graph')
  const { buildModelFactory } = await import('./ia/config')

  const config = await requireCloudLlmFeature('Rebuild do knowledge graph do sistema') as import('@shared/index').IaConfiguracao

  const factory = buildModelFactory(config)
  if (!factory) throw new Error('Provider cloud inválido para rebuild do knowledge graph do sistema.')

  // 1. Rebuild com LLM
  const result = await rebuildGraph(factory.createModel, factory.modelo, 'sistema')

  // 2. Export seed JSON pra knowledge/sistema/
  const seed = await exportGraphSeed('sistema')
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const seedPath = path.join(process.cwd(), 'knowledge', 'sistema', 'graph-seed.json')
  fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2))

  console.log(`[GRAPH] Sistema: ${seed.entities.length} entidades, ${seed.relations.length} relacoes → ${seedPath}`)

  return {
    ...result,
    seed_entities: seed.entities.length,
    seed_relations: seed.relations.length,
    exported_to: seedPath,
  }
})

// =============================================================================
// KNOWLEDGE — SEARCH + CHUNKS (2 handlers)
// =============================================================================

const knowledgeSearch = t.procedure
  .input<{ query: string; limite?: number; modo?: 'hybrid' | 'vector' | 'fts' }>()
  .action(async ({ input }) => {
    const { searchKnowledge } = await import('./knowledge/search')
    const result = await searchKnowledge(input.query, { limite: input.limite ?? 10 })
    // Enrich chunks com source info
    const enriched = []
    for (const chunk of result.chunks) {
      const source = await queryOne<{ titulo: string; tipo: string; metadata: string }>(
        'SELECT titulo, tipo, metadata::text as metadata FROM knowledge_sources WHERE id = $1',
        chunk.source_id,
      )
      enriched.push({
        ...chunk,
        source_titulo: source?.titulo ?? 'Desconhecido',
        source_tipo: source?.tipo ?? 'manual',
        source_metadata: source?.metadata ? JSON.parse(source.metadata) : {},
      })
    }
    return { chunks: enriched, relations: result.relations, total: enriched.length }
  })

const knowledgeListarChunks = t.procedure
  .input<{ source_id: number }>()
  .action(async ({ input }) => {
    const chunks = await queryAll<{
      id: number
      source_id: number
      conteudo: string
      importance: string
      last_accessed_at: string | null
      access_count: number
      enriched_at: string | null
      enrichment_json: string | null
    }>(
      `SELECT id, source_id, conteudo, importance,
              last_accessed_at::text, COALESCE(access_count, 0)::int as access_count,
              enriched_at::text, enrichment_json
       FROM knowledge_chunks
       WHERE source_id = $1
       ORDER BY id ASC`,
      input.source_id,
    )
    return chunks
  })

// =============================================================================
// KNOWLEDGE GRAPH VISUALIZER (2 handlers)
// =============================================================================

const knowledgeGraphData = t.procedure
  .input<{ origem?: 'sistema' | 'usuario'; limite?: number }>()
  .action(async ({ input }) => {
    const origem = input?.origem
    const limite = input?.limite ?? 300

    const entities = origem
      ? await queryAll<{ id: number; nome: string; tipo: string }>(
          `SELECT id, nome, tipo FROM knowledge_entities
           WHERE origem = $1 AND (valid_to IS NULL OR valid_to > NOW())
           ORDER BY criada_em DESC
           LIMIT $2`,
          origem, limite,
        )
      : await queryAll<{ id: number; nome: string; tipo: string }>(
          `SELECT id, nome, tipo FROM knowledge_entities
           WHERE (valid_to IS NULL OR valid_to > NOW())
           ORDER BY criada_em DESC
           LIMIT $1`,
          limite,
        )

    const entityIds = entities.map(e => e.id)
    if (entityIds.length === 0) {
      return { nodes: [], links: [] }
    }

    const relations = await queryAll<{
      source: number; target: number; tipo_relacao: string; peso: number
    }>(
      `SELECT kr.entity_from_id AS source, kr.entity_to_id AS target,
              kr.tipo_relacao, kr.peso
       FROM knowledge_relations kr
       WHERE kr.entity_from_id = ANY($1::int[])
         AND kr.entity_to_id = ANY($1::int[])
         AND (kr.valid_to IS NULL OR kr.valid_to > NOW())`,
      `{${entityIds.join(',')}}`,
    )

    return {
      nodes: entities.map(e => ({ id: e.id, nome: e.nome, tipo: e.tipo })),
      links: relations,
    }
  })

const knowledgeGraphExplore = t.procedure
  .input<{ entidade: string; profundidade?: number }>()
  .action(async ({ input }) => {
    const { exploreRelations } = await import('./knowledge/search')
    return await exploreRelations(input.entidade, input.profundidade ?? 2)
  })

// =============================================================================
// BACKUP / RESTORE
// =============================================================================

const dadosImportar = t.procedure.action(async (): Promise<{ tabelas: number; registros: number; repairs: number; categorias: string[] } | null> => {
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    filters: [
      { name: 'FlowKit Backup', extensions: ['zip'] },
      { name: 'JSON (legado)', extensions: ['json'] },
    ],
    properties: ['openFile' as const],
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || !result.filePaths[0]) return null

  const { parseBackupFile, importFromData } = await import('./backup')
  const { dados } = parseBackupFile(result.filePaths[0])
  const imported = await importFromData(dados)
  return { ...imported, categorias: Object.keys(dados).length > 0 ? ['backup'] : [] }
})

// =============================================================================
// BACKUP AUTOMATICO — Maquina do Tempo
// =============================================================================

const backupConfigObter = t.procedure.action(async () => {
  const { getBackupConfig, getDefaultBackupDir } = await import('./backup')
  const config = await getBackupConfig()
  const pasta_padrao = getDefaultBackupDir(app.getPath('userData'))
  return { ...config, pasta_padrao }
})

const backupConfigSalvar = t.procedure
  .input<{ pasta?: string | null; ativo?: boolean; backup_ao_fechar?: boolean; intervalo_horas?: number; max_snapshots?: number }>()
  .action(async ({ input }) => {
    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    if (input.pasta !== undefined) { sets.push(`pasta = $${idx++}`); vals.push(input.pasta) }
    if (input.ativo !== undefined) { sets.push(`ativo = $${idx++}`); vals.push(input.ativo) }
    if (input.backup_ao_fechar !== undefined) { sets.push(`backup_ao_fechar = $${idx++}`); vals.push(input.backup_ao_fechar) }
    if (input.intervalo_horas !== undefined) { sets.push(`intervalo_horas = $${idx++}`); vals.push(input.intervalo_horas) }
    if (input.max_snapshots !== undefined) { sets.push(`max_snapshots = $${idx++}`); vals.push(input.max_snapshots) }

    if (sets.length > 0) {
      sets.push('atualizado_em = NOW()')
      await execute(`UPDATE configuracao_backup SET ${sets.join(', ')} WHERE id = 1`, ...vals)
    }

    const { getBackupConfig, getDefaultBackupDir } = await import('./backup')
    const config = await getBackupConfig()
    const pasta_padrao = getDefaultBackupDir(app.getPath('userData'))
    return { ...config, pasta_padrao }
  })

const backupSnapshotsListar = t.procedure.action(async () => {
  try {
    const { listSnapshots } = await import('./backup')
    const result = await listSnapshots(app.getPath('userData'))
    console.log('[BACKUP-IPC] listar:', result.length, 'snapshots')
    return result
  } catch (err) {
    console.error('[BACKUP-IPC] listar error:', err)
    return []
  }
})

const backupSnapshotsCriar = t.procedure
  .input<{ trigger?: string; light?: boolean; scope?: 'operational' | 'full' }>()
  .action(async ({ input }) => {
    try {
      const { createSnapshot } = await import('./backup')
      const trigger = (input?.trigger ?? 'manual') as import('../shared').SnapshotTrigger
      // Backward compat: light -> operational
      const scope = input?.scope ?? (input?.light ? 'operational' : 'full')
      const result = await createSnapshot(trigger, app.getPath('userData'), app.getVersion(), { scope })
      console.log('[BACKUP-IPC] criar:', result?.filename ?? 'null (skipped)')
      return result
    } catch (err) {
      console.error('[BACKUP-IPC] criar error:', err)
      throw err
    }
  })

const backupSnapshotsRestaurar = t.procedure
  .input<{ filename: string }>()
  .action(async ({ input }) => {
    const { restoreSnapshot } = await import('./backup')
    const result = await restoreSnapshot(input.filename, app.getPath('userData'), app.getVersion(), { skipPreRestore: false })
    return result
  })

const backupSnapshotsRestaurarPreRestore = t.procedure
  .input<{ filename: string }>()
  .action(async ({ input }) => {
    const { restoreSnapshot } = await import('./backup')
    const result = await restoreSnapshot(input.filename, app.getPath('userData'), app.getVersion(), { skipPreRestore: true })
    return { tabelas: result.tabelas, registros: result.registros }
  })

const backupSnapshotsDeletar = t.procedure
  .input<{ filename: string }>()
  .action(async ({ input }) => {
    const { deleteSnapshot } = await import('./backup')
    await deleteSnapshot(input.filename, app.getPath('userData'))
    return { ok: true }
  })

const dadosExportar = t.procedure.action(async (): Promise<{ filepath: string; tamanho_mb: number } | null> => {
  const win = BrowserWindow.getFocusedWindow()
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')
  const opts = {
    defaultPath: `flowkit-backup-completo-${ts}.zip`,
    filters: [{ name: 'FlowKit Backup', extensions: ['zip'] }],
  }
  const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (result.canceled || !result.filePath) return null

  const { createExportZip } = await import('./backup')
  return createExportZip(result.filePath, app.getVersion())
})

const backupPastaEscolher = t.procedure.action(async () => {
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    properties: ['openDirectory' as const, 'createDirectory' as const],
    title: 'Escolher pasta para backups',
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

// =============================================================================
// MCP
// =============================================================================

const mcpPath = t.procedure.action(async () => {
  try {
    const resolved = resolveMcpPath()
    const isSource = isMcpSource(resolved)
    return { path: resolved, isSource }
  } catch (err) {
    return { path: null, isSource: false, error: String(err) }
  }
})

const mcpConnectClaudeCode = t.procedure.action(async () => {
  try {
    const resolved = resolveMcpPath()
    const isSource = isMcpSource(resolved)

    const args = ['mcp', 'add', 'flowkit', '--transport', 'stdio', '--scope', 'user', '--']
    if (isSource) {
      args.push('npx', 'tsx', resolved)
    } else {
      args.push(resolved)
    }

    await execFileAsync('claude', args, { timeout: 15_000 })
    return { success: true, message: 'Conectado! Reinicie o Claude Code pra ativar.' }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (msg.includes('ENOENT') || msg.includes('not found')) {
      return { success: false, message: 'Claude Code nao encontrado. Instale em https://claude.ai/download' }
    }
    return { success: false, message: `Erro: ${msg}` }
  }
})

const mcpConfigJson = t.procedure.action(async () => {
  try {
    const resolved = resolveMcpPath()
    const isSource = isMcpSource(resolved)

    const config: Record<string, unknown> = {
      mcpServers: {
        flowkit: isSource
          ? { command: 'npx', args: ['tsx', resolved] }
          : { command: resolved }
      }
    }
    return { json: JSON.stringify(config, null, 2) }
  } catch (err) {
    return { json: null, error: String(err) }
  }
})

// =============================================================================
// GALLERY
// =============================================================================

const galleryListarHandler = t.procedure
  .input<{ origem?: string; favorito?: boolean; tags?: string[]; busca?: string; limite?: number; offset?: number }>()
  .action(async ({ input }) => await _galleryListar(input))

const galleryUploadHandler = t.procedure
  .input<{ file_path?: string; data_base64?: string; mime_type?: string; nome: string; origem?: string; conversa_id?: string; source_id?: number }>()
  .action(async ({ input }) => await _galleryUpload(input as any))

const galleryRemoverHandler = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => { await galleryRemover(input.id); return { ok: true } })

const galleryToggleFavoritoHandler = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => ({ favorito: await galleryToggleFavorito(input.id) }))

const galleryAtualizarTagsHandler = t.procedure
  .input<{ id: string; tags: string[] }>()
  .action(async ({ input }) => ({ tags: await galleryAtualizarTags(input.id, input.tags) }))

const galleryLerArquivoHandler = t.procedure
  .input<{ relative_path: string }>()
  .action(async ({ input }) => (await galleryLerArquivo(input.relative_path)).toString('base64'))

// =============================================================================
// JOBS
// =============================================================================

const jobsList = t.procedure.action(async () => {
  const { listJobs } = await import('./jobs')
  return { jobs: listJobs() }
})

const jobsGet = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { getJob } = await import('./jobs')
    return { job: getJob(input.id) }
  })

const jobsCancel = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { cancelJob } = await import('./jobs')
    return { job: cancelJob(input.id) }
  })

const jobsPause = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { pauseJob } = await import('./jobs')
    return { job: pauseJob(input.id) }
  })

const jobsResume = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { resumeJob } = await import('./jobs')
    return { job: resumeJob(input.id) }
  })

// =============================================================================
// TERMINAL HARNESS
// =============================================================================

const terminalConfigGet = t.procedure.action(async () => {
  const { getTerminalHarnessConfig } = await import('./terminal/config')
  return await getTerminalHarnessConfig()
})

const terminalConfigSave = t.procedure
  .input<Partial<import('@shared/index').TerminalHarnessConfig>>()
  .action(async ({ input }) => {
    const { saveTerminalHarnessConfig } = await import('./terminal/config')
    return await saveTerminalHarnessConfig(input)
  })

const terminalOpenCli = t.procedure
  .input<{ command?: string; cwd?: string } | undefined>()
  .action(async ({ input }) => {
    const { openCliInSystemTerminal } = await import('./terminal/harness')
    return await openCliInSystemTerminal(input)
  })

const terminalAiStatus = t.procedure
  .input<{ cwd?: string } | undefined>()
  .action(async ({ input }) => {
    const { getAiTerminalReadiness } = await import('./ia/runtime-readiness')
    return await getAiTerminalReadiness(input)
  })

const terminalOpenAiTerminal = t.procedure
  .input<{ cwd?: string } | undefined>()
  .action(async ({ input }) => {
    const { openAiTerminalInSystemTerminal } = await import('./terminal/harness')
    return await openAiTerminalInSystemTerminal(input)
  })

const terminalSessionsList = t.procedure.action(async () => {
  const { listTerminalSessions } = await import('./terminal/sessions')
  return { sessions: listTerminalSessions() }
})

const terminalSessionStart = t.procedure
  .input<{ cwd?: string } | undefined>()
  .action(async ({ input }) => {
    const { startTerminalSession } = await import('./terminal/sessions')
    return { session: startTerminalSession(input) }
  })

const terminalSessionGet = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { getTerminalSession } = await import('./terminal/sessions')
    return { session: getTerminalSession(input.id) }
  })

const terminalSessionWrite = t.procedure
  .input<{ id: string; data: string }>()
  .action(async ({ input }) => {
    const { writeTerminalSession } = await import('./terminal/sessions')
    return { session: writeTerminalSession(input.id, input.data) }
  })

const terminalSessionResize = t.procedure
  .input<{ id: string; cols: number; rows: number }>()
  .action(async ({ input }) => {
    const { resizeTerminalSession } = await import('./terminal/sessions')
    return { session: resizeTerminalSession(input.id, input.cols, input.rows) }
  })

const terminalSessionKill = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const { killTerminalSession } = await import('./terminal/sessions')
    return { session: killTerminalSession(input.id) }
  })

// =============================================================================
// CONFIG KV — tabela config genérica
// =============================================================================

const configGet = t.procedure
  .input<{ key: string }>()
  .action(async ({ input }) => {
    return await queryOne<{ key: string; value: string }>(
      'SELECT key, value FROM config WHERE key = $1',
      input.key,
    )
  })

const configSet = t.procedure
  .input<{ key: string; value: string }>()
  .action(async ({ input }) => {
    await execute(
      `INSERT INTO config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      input.key,
      input.value,
    )
    return { ok: true }
  })

const configEnvDetect = t.procedure
  .input<{ vars: string[] }>()
  .action(async ({ input }) => {
    const result: Record<string, boolean> = {}
    for (const v of input.vars) {
      result[v] = Boolean(process.env[v]?.trim())
    }
    return result
  })

// =============================================================================
// CRON
// =============================================================================

const cronExecutar = t.procedure.action(async () => {
  return await runCronPipeline()
})

const cronStatus = t.procedure.action(async () => {
  const lastRun = await queryOne<{ value: unknown }>(`SELECT value FROM config WHERE key = 'cron_last_run'`)
  const autoEnabled = await queryOne<{ value: unknown }>(`SELECT value FROM config WHERE key = 'cron_auto_enabled'`)
  const lastSteps = await queryOne<{ value: unknown }>(`SELECT value FROM config WHERE key = 'cron_last_steps'`)
  return {
    last_run: parseJsonConfigValue(lastRun?.value, null),
    auto_enabled: parseJsonConfigValue(autoEnabled?.value, true),
    steps_last: parseJsonConfigValue(lastSteps?.value, null),
  }
})

// =============================================================================
// MAIA PRODUCT LAYER
// =============================================================================

const maiaLiteralRead = t.procedure
  .input<{ text?: string }>()
  .action(async ({ input }) => {
    const { runLiteralReadAction } = await import('./maia/runtime-actions')
    return runLiteralReadAction(input ?? {})
  })

const maiaContextualAsk = t.procedure
  .input<{ prompt: string; selectedText?: string; manualText?: string; includeScreenshot?: boolean; outputMode?: 'voice' | 'text' }>()
  .action(async ({ input }) => {
    const { runContextualAskAction } = await import('./maia/runtime-actions')
    return runContextualAskAction(input)
  })

const maiaContextualSummarize = t.procedure
  .input<{ selectedText?: string; manualText?: string; includeScreenshot?: boolean; outputMode?: 'voice' | 'text' }>()
  .action(async ({ input }) => {
    const { runContextualSummarizeAction } = await import('./maia/runtime-actions')
    return runContextualSummarizeAction(input ?? {})
  })

const maiaCommandRun = t.procedure
  .input<import('./maia/command-types').MaiaCommand>()
  .action(async ({ input }) => {
    const { runMaiaCommandAction } = await import('./maia/runtime-actions')
    return runMaiaCommandAction(input)
  })

const maiaPermissionsStatus = t.procedure.action(async () => {
  const { getMaiaPermissionStatus } = await import('./maia/permissions')
  return getMaiaPermissionStatus()
})

const maiaPermissionsPromptAccessibility = t.procedure.action(async () => {
  const { promptForAccessibilityPermission } = await import('./maia/permissions')
  return promptForAccessibilityPermission()
})

const maiaCommandBarOpen = t.procedure.action(async () => {
  const { openMaiaCommandBar } = await import('./maia/command-bar-window')
  return openMaiaCommandBar()
})

const maiaCommandBarClose = t.procedure.action(async () => {
  const { closeMaiaCommandBar } = await import('./maia/command-bar-window')
  return closeMaiaCommandBar()
})

const maiaCapabilitiesStatus = t.procedure.action(async () => {
  const { getMaiaCapabilities } = await import('./maia/capabilities')
  return getMaiaCapabilities()
})

const maiaHotkeysStatus = t.procedure.action(async () => {
  const { getMaiaHotkeyStatus } = await import('./maia/hotkeys')
  return getMaiaHotkeyStatus()
})

const maiaVoiceObter = t.procedure.action(async () => {
  const { getMaiaVoiceConfig } = await import('./maia/voice-config')
  return getMaiaVoiceConfig()
})

const maiaVoiceSalvar = t.procedure
  .input<Partial<import('@shared/maia-mvp-contract').MaiaVoiceConfig>>()
  .action(async ({ input }) => {
    const { saveMaiaVoiceConfig } = await import('./maia/voice-config')
    return saveMaiaVoiceConfig(input ?? {})
  })

const maiaVoiceTestar = t.procedure
  .input<{ text?: string }>()
  .action(async ({ input }) => {
    const { speakViaProvider } = await import('./maia/tts/openai-tts')
    const text = input?.text?.trim() || 'Olá, aqui é a Maiá testando a voz.'
    try {
      const result = await speakViaProvider({ text })
      return { ok: true as const, provider: result.provider }
    } catch (err: any) {
      return { ok: false as const, error: err?.message || String(err) }
    }
  })

// =============================================================================
// ROUTER
// =============================================================================

export const router = {
  // IA Local
  'ia.local.status': iaLocalStatus,
  'ia.local.models': iaLocalModels,
  'ia.local.download': iaLocalDownload,
  'ia.local.cancelDownload': iaLocalCancelDownload,
  'ia.local.deleteModel': iaLocalDeleteModel,
  'ia.local.unload': iaLocalUnload,
  'ia.stt.status': iaSttStatus,
  'ia.stt.models': iaSttModels,
  'ia.stt.download': iaSttDownload,
  'ia.stt.deleteModel': iaSttDeleteModel,
  'ia.stt.transcribe': iaSttTranscribe,
  // IA Config
  'ia.configuracao.obter': iaConfiguracaoObter,
  'ia.capabilities.obter': iaCapabilitiesObter,
  'ia.routing.obter': iaRoutingObter,
  'ia.routing.salvar': iaRoutingSalvar,
  'ia.routing.status': iaRoutingStatus,
  'ia.routing.statusAll': iaRoutingStatusAll,
  'ia.configuracao.salvar': iaConfiguracaoSalvar,
  'ia.configuracao.testar': iaConfiguracaoTestar,
  'ia.modelos.catalogo': iaModelosCatalogo,
  'ia.openrouter.testarGratuitos': iaOpenRouterTestarGratuitos,
  // IA Chat
  'ia.chat.lerArquivo': iaChatLerArquivo,
  'ia.chat.salvarAnexo': iaChatSalvarAnexo,
  'ia.chat.lerAnexoPreview': iaChatLerAnexoPreview,
  'ia.chat.enviar': iaChatEnviar,
  // IA Conversas
  'ia.conversas.listar': iaConversasListar,
  'ia.conversas.obter': iaConversasObter,
  'ia.conversas.criar': iaConversasCriar,
  'ia.conversas.renomear': iaConversasRenomear,
  'ia.conversas.arquivar': iaConversasArquivar,
  'ia.conversas.restaurar': iaConversasRestaurar,
  'ia.conversas.deletar': iaConversasDeletar,
  'ia.conversas.arquivarTodas': iaConversasArquivarTodas,
  'ia.conversas.deletarArquivadas': iaConversasDeletarArquivadas,
  // IA Mensagens
  'ia.mensagens.salvar': iaMensagensSalvar,
  'ia.mensagens.atualizar': iaMensagensAtualizar,
  'ia.mensagens.deletarApos': iaMensagensDeletarApos,
  'ia.conversas.exportar': iaConversasExportar,
  // Session Processing
  'ia.sessao.processar': iaSessaoProcessar,
  'ia.config.memoriaAutomatica': iaConfigMemoriaAutomatica,
  // Memorias IA
  'ia.memorias.listar': iaMemoriasListar,
  'ia.memorias.salvar': iaMemoriasSalvar,
  'ia.memorias.remover': iaMemoriasRemover,
  'ia.memorias.contar': iaMemoriasContar,
  // Knowledge
  'knowledge.listarFontes': knowledgeListarFontes,
  'knowledge.stats': knowledgeStats,
  'knowledge.escolherArquivo': knowledgeEscolherArquivo,
  'knowledge.escolherPasta': knowledgeEscolherPasta,
  'knowledge.importar': knowledgeImportar,
  'knowledge.bulkImport.start': knowledgeBulkImportStart,
  'knowledge.removerFonte': knowledgeRemoverFonte,
  'knowledge.toggleAtivo': knowledgeToggleAtivo,
  'knowledge.obterTextoOriginal': knowledgeObterTextoOriginal,
  'knowledge.extrairTexto': knowledgeExtrairTexto,
  'knowledge.importarArquivo': knowledgeImportarArquivo,
  'knowledge.gerarMetadataIa': knowledgeGerarMetadataIa,
  'knowledge.importarCompleto': knowledgeImportarCompleto,
  'knowledge.enrich': knowledgeEnrich,
  'knowledge.enrichmentConfig.get': knowledgeEnrichmentConfigGet,
  'knowledge.enrichmentConfig.save': knowledgeEnrichmentConfigSave,
  'knowledge.enrichmentModels.list': knowledgeEnrichmentModelsList,
  'knowledge.rebuildGraph': knowledgeRebuildGraph,
  'knowledge.graphStats': knowledgeGraphStats,
  'knowledge.rebuildAndExportSistema': knowledgeRebuildAndExportSistema,
  'knowledge.search': knowledgeSearch,
  'knowledge.listarChunks': knowledgeListarChunks,
  'knowledge.graphData': knowledgeGraphData,
  'knowledge.graphExplore': knowledgeGraphExplore,
  // Backup / Restore
  'dados.exportar': dadosExportar,
  'dados.importar': dadosImportar,
  'backup.config.obter': backupConfigObter,
  'backup.config.salvar': backupConfigSalvar,
  'backup.snapshots.listar': backupSnapshotsListar,
  'backup.snapshots.criar': backupSnapshotsCriar,
  'backup.snapshots.restaurar': backupSnapshotsRestaurar,
  'backup.snapshots.restaurarPreRestore': backupSnapshotsRestaurarPreRestore,
  'backup.snapshots.deletar': backupSnapshotsDeletar,
  'backup.pasta.escolher': backupPastaEscolher,
  // MCP
  'mcp.path': mcpPath,
  'mcp.connectClaudeCode': mcpConnectClaudeCode,
  'mcp.configJson': mcpConfigJson,
  // Gallery
  'gallery.listar': galleryListarHandler,
  'gallery.upload': galleryUploadHandler,
  'gallery.remover': galleryRemoverHandler,
  'gallery.toggleFavorito': galleryToggleFavoritoHandler,
  'gallery.atualizarTags': galleryAtualizarTagsHandler,
  'gallery.lerArquivo': galleryLerArquivoHandler,
  // Jobs
  'jobs.list': jobsList,
  'jobs.get': jobsGet,
  'jobs.cancel': jobsCancel,
  'jobs.pause': jobsPause,
  'jobs.resume': jobsResume,
  // Terminal
  'terminal.config.get': terminalConfigGet,
  'terminal.config.save': terminalConfigSave,
  'terminal.openCli': terminalOpenCli,
  'terminal.aiStatus': terminalAiStatus,
  'terminal.openAiTerminal': terminalOpenAiTerminal,
  'terminal.sessions.list': terminalSessionsList,
  'terminal.sessions.start': terminalSessionStart,
  'terminal.sessions.get': terminalSessionGet,
  'terminal.sessions.write': terminalSessionWrite,
  'terminal.sessions.resize': terminalSessionResize,
  'terminal.sessions.kill': terminalSessionKill,
  // Cron
  'cron.executar': cronExecutar,
  'cron.status': cronStatus,
  // Maia product layer
  'maia.literal.read': maiaLiteralRead,
  'maia.contextual.ask': maiaContextualAsk,
  'maia.contextual.summarize': maiaContextualSummarize,
  'maia.command.run': maiaCommandRun,
  'maia.permissions.status': maiaPermissionsStatus,
  'maia.permissions.promptAccessibility': maiaPermissionsPromptAccessibility,
  'maia.commandBar.open': maiaCommandBarOpen,
  'maia.commandBar.close': maiaCommandBarClose,
  'maia.capabilities.status': maiaCapabilitiesStatus,
  'maia.hotkeys.status': maiaHotkeysStatus,
  'maia.voice.obter': maiaVoiceObter,
  'maia.voice.salvar': maiaVoiceSalvar,
  'maia.voice.testar': maiaVoiceTestar,
  // Config KV
  'config.get': configGet,
  'config.set': configSet,
  'config.envDetect': configEnvDetect,
  // App info
  'app:version': t.procedure.action(async () => {
    try {
      const electron = require('electron') as { app?: { getVersion?: () => string } }
      return electron.app?.getVersion?.() ?? '0.0.0'
    } catch {
      return '0.0.0'
    }
  }),
}

export type Router = typeof router
