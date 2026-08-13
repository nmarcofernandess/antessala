import { queryOne, execute } from '../db/query'
import { buildModelFactory } from '../ia/config'
import { isGeminiCloudApiEnabled } from '../config/app-config'
import { assertIaRouteReady } from '../ia/routing'
import { buildProviderBackedIaConfig, getActiveIaConfig, getRouteProviderModel, getRouteProviderToken } from '../ia/route-config'
import {
  createAiSdkEnrichmentModel,
  createLocalEnrichmentModel,
  type EnrichmentModel,
} from './enrichment'
import type {
  KnowledgeEnrichmentConfig,
  KnowledgeEnrichmentModelOption,
  KnowledgeEnrichmentProvider,
} from '../../shared/types'

export const KNOWLEDGE_ENRICHMENT_CONFIG_KEY = 'knowledge.enrichment'

export const DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG: KnowledgeEnrichmentConfig = {
  auto_enrich_after_import: false,
  provider: 'auto',
  modelo: 'auto',
  force_all_default: false,
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeConfig(input: Partial<KnowledgeEnrichmentConfig> | null | undefined): KnowledgeEnrichmentConfig {
  const provider = input?.provider && ['auto', 'local', 'gemini', 'openrouter'].includes(input.provider)
    ? input.provider
    : DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.provider

  return {
    auto_enrich_after_import: Boolean(input?.auto_enrich_after_import ?? DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.auto_enrich_after_import),
    provider: provider as KnowledgeEnrichmentProvider,
    modelo: String(input?.modelo || DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.modelo),
    force_all_default: Boolean(input?.force_all_default ?? DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.force_all_default),
  }
}

async function buildKnowledgeEnrichmentModelForProvider(
  provider: Exclude<KnowledgeEnrichmentProvider, 'auto'>,
  modelo: string,
): Promise<EnrichmentModel | null> {
  if (provider === 'local') {
    const options = await listKnowledgeEnrichmentModelOptions()
    const option = options.find((entry) => entry.provider === 'local' && entry.modelo === modelo)
    if (!option?.available) {
      throw new Error(option?.reason || `Modelo local "${modelo}" indisponivel.`)
    }
    return createLocalEnrichmentModel(modelo)
  }

  const iaConfig = await getActiveIaConfig()
  if (!iaConfig) return null

  const cloudConfig = buildProviderBackedIaConfig(iaConfig, provider, modelo)
  const factory = buildModelFactory(cloudConfig)
  if (!factory) {
    throw new Error(`Modelo ${provider}/${modelo} indisponivel para enrichment.`)
  }
  return createAiSdkEnrichmentModel(factory.createModel, factory.modelo, provider)
}

export async function getKnowledgeEnrichmentConfig(): Promise<KnowledgeEnrichmentConfig> {
  const row = await queryOne<{ value: unknown }>(
    'SELECT value FROM config WHERE key = $1',
    KNOWLEDGE_ENRICHMENT_CONFIG_KEY,
  )
  return normalizeConfig(parseJsonValue<Partial<KnowledgeEnrichmentConfig>>(row?.value, DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG))
}

export async function saveKnowledgeEnrichmentConfig(input: Partial<KnowledgeEnrichmentConfig>): Promise<KnowledgeEnrichmentConfig> {
  const current = await getKnowledgeEnrichmentConfig()
  const next = normalizeConfig({ ...current, ...input })
  await execute(
    `INSERT INTO config (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb`,
    KNOWLEDGE_ENRICHMENT_CONFIG_KEY,
    JSON.stringify(next),
  )
  return next
}

export async function listKnowledgeEnrichmentModelOptions(): Promise<KnowledgeEnrichmentModelOption[]> {
  const [iaConfig, local] = await Promise.all([
    getActiveIaConfig(),
    import('../ia/local-llm'),
  ])
  const localStatus = local.getLocalStatus()

  const localOptions = Object.entries(local.LOCAL_MODELS).map(([modelo, model]) => {
    const status = localStatus.modelos[modelo]
    const available = Boolean(status?.usable)
    const reason = status?.load_error
      ? `Modelo local falhou ao carregar: ${status.load_error}`
      : status?.baixado
        ? 'Modelo local baixado, mas precisa passar em Testar conexao antes do enrichment.'
        : 'Modelo local nao baixado.'
    return {
      provider: 'local' as const,
      modelo,
      label: model.label,
      available,
      reason: available ? undefined : reason,
    }
  })

  const geminiToken = getRouteProviderToken(iaConfig, 'gemini')
  const geminiEnabled = isGeminiCloudApiEnabled()
  const geminiAvailable = geminiEnabled && geminiToken.length > 0
  const geminiReason = !geminiEnabled
    ? 'Gemini API direta desativada nesta build.'
    : geminiAvailable ? undefined : 'API key Gemini nao configurada.'

  const openrouterToken = getRouteProviderToken(iaConfig, 'openrouter')
  const openrouterAvailable = openrouterToken.length > 0

  return [
    ...localOptions,
    {
      provider: 'gemini',
      modelo: getRouteProviderModel(iaConfig, 'gemini'),
      label: getRouteProviderModel(iaConfig, 'gemini'),
      available: geminiAvailable,
      reason: geminiReason,
    },
    {
      provider: 'openrouter',
      modelo: getRouteProviderModel(iaConfig, 'openrouter'),
      label: getRouteProviderModel(iaConfig, 'openrouter'),
      available: openrouterAvailable,
      reason: openrouterAvailable ? undefined : 'API key OpenRouter nao configurada.',
    },
  ]
}

async function buildKnowledgeEnrichmentModelFromConfig(
  config: KnowledgeEnrichmentConfig,
): Promise<EnrichmentModel | null> {
  if (config.provider === 'auto') return null
  return buildKnowledgeEnrichmentModelForProvider(config.provider, config.modelo)
}

export async function buildKnowledgeEnrichmentModel(
  configOverride?: KnowledgeEnrichmentConfig,
  options: { explicitOverride?: boolean } = {},
): Promise<EnrichmentModel | null> {
  const baseConfig = configOverride ?? await getKnowledgeEnrichmentConfig()

  if (options.explicitOverride === true) {
    if (baseConfig.provider !== 'auto') {
      return buildKnowledgeEnrichmentModelFromConfig(baseConfig)
    }
    // A model was chosen but no provider: don't silently route past the explicit model.
    if (baseConfig.modelo && baseConfig.modelo !== 'auto') {
      throw new Error('Para escolher um modelo de enrichment, informe também o provider (local, gemini ou openrouter).')
    }
  }

  const route = await assertIaRouteReady('rag_enrichment', { validateLocal: true })
  if (!route.provider || !route.model) {
    throw new Error('Rota de enriquecimento do RAG sem provider/modelo pronto.')
  }

  return buildKnowledgeEnrichmentModelForProvider(route.provider, route.model)
}
