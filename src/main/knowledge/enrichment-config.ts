import { queryOne, execute } from '../db/query'
import { buildModelFactory, PROVIDER_DEFAULTS, resolveModel } from '../ia/config'
import { isGeminiCloudApiEnabled } from '../config/app-config'
import {
  createAiSdkEnrichmentModel,
  type EnrichmentModel,
} from './enrichment'
import type { IaConfiguracao } from '../../shared/types'
import type {
  KnowledgeEnrichmentConfig,
  KnowledgeEnrichmentModelOption,
  KnowledgeEnrichmentProvider,
} from '../../shared/types'

export const KNOWLEDGE_ENRICHMENT_CONFIG_KEY = 'knowledge.enrichment'

export const DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG: KnowledgeEnrichmentConfig = {
  auto_enrich_after_import: false,
  provider: 'gemini',
  modelo: PROVIDER_DEFAULTS.gemini,
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
  const modelo = input?.provider === 'gemini' && input.modelo && !input.modelo.includes('/')
    ? input.modelo
    : PROVIDER_DEFAULTS.gemini

  return {
    auto_enrich_after_import: Boolean(input?.auto_enrich_after_import ?? DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.auto_enrich_after_import),
    provider: 'gemini',
    modelo,
    force_all_default: Boolean(input?.force_all_default ?? DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.force_all_default),
  }
}

async function buildKnowledgeEnrichmentModelForProvider(
  provider: Exclude<KnowledgeEnrichmentProvider, 'auto'>,
  modelo: string,
): Promise<EnrichmentModel | null> {
  const iaConfig = await getActiveIaConfig()
  if (!iaConfig) return null

  const cloudConfig = configForProvider(iaConfig, provider, modelo)
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
  const iaConfig = await getActiveIaConfig()
  const geminiToken = getProviderToken(iaConfig, 'gemini')
  const geminiEnabled = isGeminiCloudApiEnabled()
  const geminiAvailable = geminiEnabled && geminiToken.length > 0
  const geminiReason = !geminiEnabled
    ? 'Gemini API direta desativada nesta build.'
    : geminiAvailable ? undefined : 'API key Gemini nao configurada.'

  return [
    {
      provider: 'gemini',
      modelo: getProviderModel(iaConfig, 'gemini'),
      label: getProviderModel(iaConfig, 'gemini'),
      available: geminiAvailable,
      reason: geminiReason,
    },
  ]
}

async function buildKnowledgeEnrichmentModelFromConfig(
  config: KnowledgeEnrichmentConfig,
): Promise<EnrichmentModel | null> {
  return buildKnowledgeEnrichmentModelForProvider('gemini', config.modelo)
}

export async function buildKnowledgeEnrichmentModel(
  configOverride?: KnowledgeEnrichmentConfig,
  options: { explicitOverride?: boolean } = {},
): Promise<EnrichmentModel | null> {
  const baseConfig = configOverride ?? await getKnowledgeEnrichmentConfig()

  if (options.explicitOverride === true) {
    return buildKnowledgeEnrichmentModelFromConfig(baseConfig)
  }

  const iaConfig = await getActiveIaConfig()
  if (!iaConfig || !getProviderToken(iaConfig, 'gemini')) {
    throw new Error('Enriquecimento do conhecimento requer Gemini configurado.')
  }
  return buildKnowledgeEnrichmentModelForProvider(
    'gemini',
    getProviderModel(iaConfig, 'gemini'),
  )
}

async function getActiveIaConfig(): Promise<IaConfiguracao | null> {
  return await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia LIMIT 1') ?? null
}

type CloudProvider = IaConfiguracao['provider']

function providerSettings(config: IaConfiguracao | null): Record<string, { token?: string; modelo?: string }> {
  if (!config?.provider_configs_json) return {}
  try {
    const parsed = typeof config.provider_configs_json === 'string'
      ? JSON.parse(config.provider_configs_json)
      : config.provider_configs_json
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getProviderToken(config: IaConfiguracao | null, provider: CloudProvider): string {
  if (!config) return ''
  const configured = providerSettings(config)[provider]?.token?.trim()
  if (configured) return configured
  return config.provider === provider ? config.api_key?.trim() ?? '' : ''
}

function getProviderModel(config: IaConfiguracao | null, provider: CloudProvider): string {
  if (!config) return PROVIDER_DEFAULTS[provider]
  return resolveModel({ ...config, provider }, provider)
}

function configForProvider(
  config: IaConfiguracao,
  provider: CloudProvider,
  modelo: string,
): IaConfiguracao {
  return {
    ...config,
    provider,
    modelo,
    api_key: getProviderToken(config, provider),
  }
}
