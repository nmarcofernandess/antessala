import { useCallback, useEffect, useState } from 'react'
import { client } from '@/servicos/client'

export type CloudIaProvider = 'gemini' | 'openrouter'

export interface CloudIaConfig {
  provider: CloudIaProvider
  apiKey: string
  modelo: string
}

export const CLOUD_PROVIDER_DEFAULTS: Record<CloudIaProvider, string> = {
  gemini: 'gemini-3.5-flash',
  openrouter: 'openai/gpt-oss-20b:free',
}

export const CLOUD_PROVIDER_LABELS: Record<CloudIaProvider, string> = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
}

type ProviderConfigMap = Partial<Record<CloudIaProvider, { token?: string; modelo?: string }>>

function parseProviderConfigs(raw: unknown): ProviderConfigMap {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as ProviderConfigMap
  if (typeof raw !== 'string') return {}

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as ProviderConfigMap : {}
  } catch {
    return {}
  }
}

export function normalizeCloudIaConfig(raw: unknown): CloudIaConfig | null {
  if (!raw || typeof raw !== 'object') return null

  const row = raw as Record<string, unknown>
  if (row.provider !== 'gemini' && row.provider !== 'openrouter') return null

  const provider = row.provider
  const providerConfigs = parseProviderConfigs(row.provider_configs ?? row.provider_configs_json)
  const selected = providerConfigs[provider]
  const legacyApiKey = typeof row.api_key === 'string' ? row.api_key : ''
  const legacyModel = typeof row.modelo === 'string' ? row.modelo : ''

  return {
    provider,
    apiKey: selected?.token?.trim() || legacyApiKey.trim(),
    modelo: selected?.modelo?.trim() || legacyModel.trim() || CLOUD_PROVIDER_DEFAULTS[provider],
  }
}

interface IaModelConfigState {
  config: CloudIaConfig | null
  providerLabel: string
  isLoading: boolean
  canSendMessages: boolean
  activeProviderReason?: string
  reload: () => Promise<void>
}

export function useIaModelConfig(): IaModelConfigState {
  const [config, setConfig] = useState<CloudIaConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeProviderReason, setActiveProviderReason] = useState<string>()

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const raw = await client['ia.configuracao.obter']()
      const normalized = normalizeCloudIaConfig(raw)
      setConfig(normalized)
      setActiveProviderReason(
        normalized
          ? undefined
          : 'Configure uma IA em Configurações antes de iniciar uma conversa.',
      )
    } catch (error) {
      console.error('[IA] Falha ao carregar configuração:', error)
      setConfig(null)
      setActiveProviderReason(
        error instanceof Error ? error.message : 'Não foi possível carregar a configuração de IA.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()

    const handleConfigChange = () => { void reload() }
    window.addEventListener('ia-config-changed', handleConfigChange)
    return () => window.removeEventListener('ia-config-changed', handleConfigChange)
  }, [reload])

  const canSendMessages = Boolean(config?.apiKey.trim() && config?.modelo.trim())

  return {
    config,
    providerLabel: config ? CLOUD_PROVIDER_LABELS[config.provider] : 'IA não configurada',
    isLoading,
    canSendMessages,
    activeProviderReason: canSendMessages
      ? undefined
      : activeProviderReason || 'Informe um token e um modelo em Configurações.',
    reload,
  }
}
