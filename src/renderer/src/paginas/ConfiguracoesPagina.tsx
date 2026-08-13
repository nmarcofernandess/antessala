import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Settings,
  Monitor,
  Sun,
  Moon,
  Check,
  Download,
  Upload,
  CheckCircle2,
  Loader2,
  BrainCircuit,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  HardDrive,
  WifiOff,
  ChevronDown,
  Info,
  Clock,
  Play,
  ToggleLeft,
  ToggleRight,
  SquareTerminal,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Form } from '@/components/ui/form'
import { PageHeader } from '@/componentes/PageHeader'
import { DirtyGuardDialog } from '@/componentes/DirtyGuardDialog'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'
import { useApiData } from '@/hooks/useApiData'
import { useColorTheme } from '@/hooks/useColorTheme'
import { useAppVersion } from '@/hooks/useAppVersion'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/app-info'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { IaModelPill } from '@/componentes/IaModelPill'
import { AiRoutingSection } from '@/componentes/ai/AiRoutingSection'
import { VozDaMaiaCard } from '@/componentes/maia/VozDaMaiaCard'
import { client } from '@/servicos/client'
import { servicoConhecimento } from '@/servicos/conhecimento'
import { servicoTerminal } from '@/servicos/terminal'

import type {
  IaProviderId,
  IaCapabilities,
  IaModelCatalogResult,
  IaOpenRouterFreeModelsTestResult,
  KnowledgeEnrichmentConfig,
  KnowledgeEnrichmentModelOption,
  TerminalHarnessConfig,
} from '@shared/types'
import type { AiRouteResolution } from '@shared/index'
import { IaModelCatalogPicker } from '@/componentes/IaModelCatalogPicker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/* ---------- IA provider config types & constants ---------- */

type IaProviderConfigForm = {
  token?: string
  modelo?: string
  favoritos?: string[]
}

const IA_PROVIDER_LABELS: Record<IaProviderId, string> = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter (Gateway)',
  local: 'IA Local (Offline)',
}

const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash'
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-20b:free'
const OPENROUTER_FREE_ROUTER_MODEL = 'openrouter/free'

const IA_PROVIDER_MODELS: Record<IaProviderId, Array<{ value: string; label: string }>> = {
  gemini: [
    { value: GEMINI_DEFAULT_MODEL, label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
  ],
  openrouter: [
    { value: OPENROUTER_DEFAULT_MODEL, label: 'OpenAI gpt-oss 20B (free)' },
    { value: OPENROUTER_FREE_ROUTER_MODEL, label: 'Free Models Router' },
  ],
  local: [
    { value: 'gemma-4-e2b-it-q4', label: 'Gemma 4 E2B IT' },
  ],
}

const IA_PROVIDER_DOCS: Partial<Record<IaProviderId, string>> = {
  gemini: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/keys',
}

/* ---------- IA helpers ---------- */

function getDefaultProviderConfigs() {
  return {
    gemini: {
      token: '',
      modelo: IA_PROVIDER_MODELS.gemini[0].value,
      favoritos: [] as string[],
    },
    openrouter: {
      token: '',
      modelo: IA_PROVIDER_MODELS.openrouter[0].value,
      favoritos: [] as string[],
    },
    local: {
      token: '',
      modelo: IA_PROVIDER_MODELS.local[0].value,
      favoritos: [] as string[],
    },
  }
}

function normalizeProviderConfigs(input: any, iaConfig?: any) {
  const defaults = getDefaultProviderConfigs()
  const incoming = input && typeof input === 'object' ? input : {}
  const geminiLegacyToken = typeof iaConfig?.api_key === 'string' ? iaConfig.api_key : ''
  const geminiLegacyModel = typeof iaConfig?.modelo === 'string' ? iaConfig.modelo : defaults.gemini.modelo

  return {
    gemini: {
      ...defaults.gemini,
      ...(incoming.gemini || {}),
      token: (incoming.gemini?.token ?? geminiLegacyToken ?? '').toString(),
      modelo: (incoming.gemini?.modelo ?? geminiLegacyModel ?? defaults.gemini.modelo).toString(),
    },
    openrouter: {
      ...defaults.openrouter,
      ...(incoming.openrouter || {}),
    },
    local: {
      ...defaults.local,
      ...(incoming.local || {}),
    },
  }
}

function buildIaFormValues(iaConfig?: any) {
  let parsedProviderConfigs: any = iaConfig?.provider_configs
  if (!parsedProviderConfigs && iaConfig?.provider_configs_json) {
    try {
      parsedProviderConfigs = JSON.parse(iaConfig.provider_configs_json)
    } catch {
      parsedProviderConfigs = {}
    }
  }

  const normalized = normalizeProviderConfigs(parsedProviderConfigs, iaConfig)
  const provider = (iaConfig?.provider || 'gemini') as IaProviderId
  const activeModel = normalized[provider]?.modelo || iaConfig?.modelo || IA_PROVIDER_MODELS[provider][0].value
  const activeToken = provider === 'gemini'
    ? (normalized.gemini.token || iaConfig?.api_key || '')
    : ''

  return {
    provider,
    api_key: activeToken,
    modelo: activeModel,
    provider_configs: normalized,
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`
}

/* ---------- main component ---------- */

export function ConfiguracoesPagina() {
  const { theme: currentMode, setTheme } = useTheme()
  const { colorTheme, setColorTheme } = useColorTheme()
  const appVersion = useAppVersion()

  /* --- Backup state --- */
  const [backupNowLoading, setBackupNowLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  /* --- Cron state --- */
  const [cronAutoEnabled, setCronAutoEnabled] = useState(true)
  const [cronLastRun, setCronLastRun] = useState<string | null>(null)
  const [cronProcessando, setCronProcessando] = useState(false)
  const [enrichmentConfig, setEnrichmentConfig] = useState<KnowledgeEnrichmentConfig | null>(null)
  const [enrichmentModels, setEnrichmentModels] = useState<KnowledgeEnrichmentModelOption[]>([])
  const [enrichmentSaving, setEnrichmentSaving] = useState(false)
  const [terminalConfig, setTerminalConfig] = useState<TerminalHarnessConfig | null>(null)
  const [terminalSaving, setTerminalSaving] = useState(false)
  const [terminalAdvancedOpen, setTerminalAdvancedOpen] = useState(false)
  const [chatRouteStatus, setChatRouteStatus] = useState<AiRouteResolution | null>(null)

  useEffect(() => {
    client['cron.status']().then((status) => {
      setCronAutoEnabled(status.auto_enabled)
      setCronLastRun(status.last_run)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.electron.ipcRenderer.invoke('backup.config.obter').then((config: any) => {
      setLastBackup(config?.ultimo_backup ?? null)
    }).catch(() => {})
  }, [])

  const reloadEnrichmentSettings = async () => {
    try {
      const [config, models] = await Promise.all([
        servicoConhecimento.enrichmentConfig(),
        servicoConhecimento.listarEnrichmentModels(),
      ])
      setEnrichmentConfig(config)
      setEnrichmentModels(models)
    } catch {
      setEnrichmentConfig(null)
      setEnrichmentModels([])
    }
  }

  useEffect(() => {
    reloadEnrichmentSettings()
  }, [])

  const reloadTerminalSettings = async () => {
    try {
      setTerminalConfig(await servicoTerminal.config())
    } catch {
      setTerminalConfig(null)
    }
  }

  useEffect(() => {
    reloadTerminalSettings()
  }, [])

  const reloadChatRouteStatus = async () => {
    try {
      setChatRouteStatus(await servicoConhecimento.obterIaRouteStatus('chat_ui', { validateLocal: true }))
    } catch {
      setChatRouteStatus(null)
    }
  }

  useEffect(() => {
    void reloadChatRouteStatus()
    const handler = () => { void reloadChatRouteStatus() }
    window.addEventListener('ia-config-changed', handler)
    return () => window.removeEventListener('ia-config-changed', handler)
  }, [])

  async function handleBackupNow() {
    setBackupNowLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('backup.snapshots.criar', { trigger: 'manual', scope: 'operational' }) as any
      if (result) {
        toast.success('Backup criado!', { description: `${result.meta.registros} registros salvos` })
        const config = await window.electron.ipcRenderer.invoke('backup.config.obter') as any
        setLastBackup(config?.ultimo_backup ?? null)
      } else {
        toast.info('Backup ja em andamento')
      }
    } catch (err) {
      toast.error('Erro ao criar backup', { description: (err as Error).message })
    } finally {
      setBackupNowLoading(false)
    }
  }

  async function handleExportarCompleto() {
    setExportLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('dados.exportar') as { filepath: string; tamanho_mb: number } | null
      if (result) {
        toast.success('Backup completo exportado!', { description: `${result.tamanho_mb} MB` })
      }
    } catch (err) {
      toast.error('Erro ao exportar', { description: (err as Error).message })
    } finally {
      setExportLoading(false)
    }
  }

  async function handleImportar() {
    setImportLoading(true)
    try {
      const res = await window.electron.ipcRenderer.invoke('dados.importar') as {
        tabelas: number; registros: number; categorias: string[]
      } | null
      if (res) {
        toast.success('Dados importados!', {
          description: `${res.tabelas} tabelas, ${res.registros} registros. Reinicie o app.`,
        })
      }
    } catch (err: any) {
      toast.error('Erro ao importar', { description: err?.message ?? 'Erro desconhecido' })
    } finally {
      setImportLoading(false)
    }
  }

  async function saveEnrichmentPatch(patch: Partial<KnowledgeEnrichmentConfig>) {
    setEnrichmentSaving(true)
    try {
      const saved = await servicoConhecimento.salvarEnrichmentConfig({
        ...(enrichmentConfig ?? {}),
        ...patch,
      })
      setEnrichmentConfig(saved)
      toast.success('Configuração de enrichment salva.')
    } catch (err: any) {
      toast.error('Erro ao salvar enrichment', { description: err?.message })
    } finally {
      setEnrichmentSaving(false)
    }
  }

  async function saveTerminalPatch(patch: Partial<TerminalHarnessConfig>) {
    setTerminalSaving(true)
    try {
      const saved = await servicoTerminal.salvarConfig({
        ...(terminalConfig ?? {}),
        ...patch,
      })
      setTerminalConfig(saved)
      toast.success('Configuração de terminal salva.')
    } catch (err: any) {
      toast.error('Erro ao salvar terminal', { description: err?.message })
    } finally {
      setTerminalSaving(false)
    }
  }

  async function abrirCliFlowKit() {
    try {
      const result = await servicoTerminal.abrirCli()
      toast.success(result.opened ? 'CLI aberto no Terminal.' : 'Comando preparado.', {
        description: result.command,
      })
    } catch (err: any) {
      toast.error('Erro ao abrir CLI', { description: err?.message })
    }
  }

  /* --- IA form --- */
  const [localModels, setLocalModels] = useState<Array<{
    id: string
    label: string
    filename: string
    size_bytes: number
    ram_minima_gb: number
    descricao: string
    baixado: boolean
    usable?: boolean
    requires_validation?: boolean
    load_error?: string
    validated_at?: string
    tamanho_atual_bytes?: number
    download_status?: 'idle' | 'downloading' | 'cancelled' | 'failed' | 'done'
    download_progresso?: number
    download_bytes_total?: number
    download_bytes_feitos?: number
    download_error?: string
  }>>([])
  const [localModelBusy, setLocalModelBusy] = useState<string | null>(null)
  const { data: iaCapabilities, reload: reloadIaCapabilities } = useApiData<IaCapabilities>(
    () => window.electron.ipcRenderer.invoke('ia.capabilities.obter'),
    []
  )

  const reloadLocalModels = async () => {
    try {
      const models = await window.electron.ipcRenderer.invoke('ia.local.models') as typeof localModels
      setLocalModels(models)
    } catch {
      setLocalModels([])
    }
  }

  useEffect(() => {
    reloadLocalModels()
  }, [])

  useEffect(() => {
    const dispose = window.electron.ipcRenderer.on('ia:local:status-changed', () => {
      void reloadLocalModels()
      reloadIaCapabilities()
      window.dispatchEvent(new Event('ia-config-changed'))
    })
    return dispose
  }, [reloadIaCapabilities])

  const usableLocalSet = new Set(localModels.filter((model) => model.usable).map((model) => model.id))
  const downloadedLocalSet = new Set(localModels.filter((model) => model.baixado).map((model) => model.id))
  const localModelNeedsValidation = localModels.some((model) => model.requires_validation)
  const localModelError = localModels.find((model) => model.load_error)
  const localModelDownloading = localModels.find((model) => model.download_status === 'downloading')

  const iaForm = useForm({
    resolver: zodResolver(
      z.object({
        provider: z.enum(['gemini', 'openrouter', 'local']),
        api_key: z.string().optional(),
        modelo: z.string(),
        provider_configs: z.object({
          gemini: z.object({
            token: z.string().optional(),
            modelo: z.string().optional(),
            favoritos: z.array(z.string()).optional(),
          }),
          openrouter: z.object({
            token: z.string().optional(),
            modelo: z.string().optional(),
            favoritos: z.array(z.string()).optional(),
          }),
          local: z.object({
            token: z.string().optional(),
            modelo: z.string().optional(),
            favoritos: z.array(z.string()).optional(),
          }),
        }),
      })
    ),
    defaultValues: {
      provider: 'gemini' as IaProviderId,
      api_key: '',
      modelo: IA_PROVIDER_MODELS.gemini[0].value,
      provider_configs: getDefaultProviderConfigs(),
    },
  })

  const blocker = useDirtyGuard({ isDirty: iaForm.formState.isDirty })

  const { data: iaConfig, reload: reloadIaConfig } = useApiData<any>(
    () => window.electron.ipcRenderer.invoke('ia.configuracao.obter'),
    []
  )

  useEffect(() => {
    if (iaConfig) {
      iaForm.reset(buildIaFormValues(iaConfig))
    }
  }, [iaConfig, iaForm])

  const [testandoIa, setTestandoIa] = useState(false)
  const [salvandoIa, setSalvandoIa] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelCatalogByProvider, setModelCatalogByProvider] = useState<Partial<Record<IaProviderId, IaModelCatalogResult>>>({})
  const [modelCatalogBusyProvider, setModelCatalogBusyProvider] = useState<IaProviderId | null>(null)
  const [openrouterTestedModelIds, setOpenrouterTestedModelIds] = useState<string[]>([])
  const [testandoOpenrouterGratuitos, setTestandoOpenrouterGratuitos] = useState(false)

  const iaProvider = (iaForm.watch('provider') || 'gemini') as IaProviderId
  const providerConfigs = iaForm.watch('provider_configs') as ReturnType<typeof getDefaultProviderConfigs>
  const selectedProviderConfig = (providerConfigs?.[iaProvider] || {}) as IaProviderConfigForm
  const remoteCatalog = modelCatalogByProvider[iaProvider]
  const openrouterFavoritos = providerConfigs?.openrouter?.favoritos ?? []

  const providerCapability = (provider: IaProviderId) =>
    iaCapabilities?.providers.find((entry) => entry.provider === provider)
  const getLocalAvailabilityFallback = (): { available: boolean; reason?: string } => {
    if (usableLocalSet.size > 0) return { available: true }
    if (localModelError?.load_error) {
      return { available: false, reason: `Modelo local falhou ao carregar: ${localModelError.load_error}` }
    }
    if (localModelDownloading) return { available: false, reason: 'Download de modelo local em andamento.' }
    if (localModelNeedsValidation || downloadedLocalSet.size > 0) {
      return { available: false, reason: 'Modelo local baixado, mas precisa passar em Testar conexao.' }
    }
    return { available: false, reason: 'Nenhum modelo local instalado.' }
  }

  const providerAvailability: Record<IaProviderId, { available: boolean; reason?: string }> = {
    gemini: providerCapability('gemini') ?? {
      available: Boolean((providerConfigs?.gemini?.token || '').trim()),
      reason: (providerConfigs?.gemini?.token || '').trim() ? undefined : 'API key nao configurada.',
    },
    openrouter: providerCapability('openrouter') ?? {
      available: Boolean((providerConfigs?.openrouter?.token || '').trim()),
      reason: (providerConfigs?.openrouter?.token || '').trim() ? undefined : 'API key nao configurada.',
    },
    local: providerCapability('local') ?? getLocalAvailabilityFallback(),
  }

  const hasAnyProviderAvailable = iaCapabilities?.has_any_available_provider
    ?? Object.values(providerAvailability).some((p) => p.available)
  const selectedProviderAvailability = providerAvailability[iaProvider]

  const iaStatusBadge = chatRouteStatus
    ? chatRouteStatus.ok
      ? {
          label: 'IA pronta',
          className: 'border-green-500/50 dark:border-green-500/30 text-green-600 dark:text-green-400',
        }
      : {
          label: 'IA indisponível',
          className: 'border-amber-500/50 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
        }
    : hasAnyProviderAvailable
      ? {
          label: 'Verificando…',
          className: 'border-muted-foreground/30 text-muted-foreground',
        }
      : {
          label: 'Sem IA disponível',
          className: 'border-destructive/50 text-destructive',
        }

  const providerSelectorOptions = [
    { provider: 'gemini' as const, label: 'Google Gemini', disabled: false },
    { provider: 'openrouter' as const, label: 'OpenRouter', disabled: false },
    { provider: 'local' as const, label: 'IA Local (Offline)', disabled: false },
  ]

  const currentModelOptions = (() => {
    if (iaProvider === 'local') return IA_PROVIDER_MODELS.local
    if (!remoteCatalog?.models?.length) return IA_PROVIDER_MODELS[iaProvider]
    if (iaProvider === 'openrouter') {
      const defaultEntry = { value: OPENROUTER_DEFAULT_MODEL, label: 'OpenAI gpt-oss 20B (free)' }
      const routerEntry = { value: OPENROUTER_FREE_ROUTER_MODEL, label: 'Free Models Router' }
      if (openrouterFavoritos.length > 0) {
        const favSet = new Set(openrouterFavoritos)
        const favModels = remoteCatalog.models
          .filter((m) => favSet.has(m.id) && m.id !== OPENROUTER_DEFAULT_MODEL && m.id !== OPENROUTER_FREE_ROUTER_MODEL)
          .map((m) => ({ value: m.id, label: m.label }))
        return [defaultEntry, routerEntry, ...favModels]
      }
      return [defaultEntry, routerEntry]
    }
    return remoteCatalog.models.map((m) => ({ value: m.id, label: m.label }))
  })()

  const currentModelValue = iaForm.watch('modelo')
  const providerStoredModel = (selectedProviderConfig?.modelo || '').trim()
  const providerDefaultModel = currentModelOptions[0]?.value || IA_PROVIDER_MODELS[iaProvider][0].value

  const selectorModelOptions = (() => {
    if (iaProvider === 'local') {
      if (selectedProviderAvailability.available) {
        return IA_PROVIDER_MODELS.local
          .filter((model) => usableLocalSet.has(model.value))
          .map((model) => ({ id: model.value, label: model.label, disabled: false }))
      }
      return IA_PROVIDER_MODELS.local.map((model) => ({ id: model.value, label: model.label, disabled: true }))
    }

    const base = currentModelOptions.map((model) => ({
      id: model.value,
      label: model.label,
      disabled: !selectedProviderAvailability.available,
    }))

    if (currentModelValue && !base.some((model) => model.id === currentModelValue)) {
      return [
        ...base,
        {
          id: currentModelValue,
          label: currentModelValue,
          disabled: !selectedProviderAvailability.available,
        },
      ]
    }

    return base
  })()

  const resolvedCurrentModelValue = (() => {
    if (currentModelValue && selectorModelOptions.some((model) => model.id === currentModelValue)) {
      return currentModelValue
    }
    if (providerStoredModel && selectorModelOptions.some((model) => model.id === providerStoredModel)) {
      return providerStoredModel
    }
    if (selectedProviderAvailability.available) {
      return selectorModelOptions.find((model) => !model.disabled)?.id || providerDefaultModel
    }
    return currentModelValue || providerStoredModel || providerDefaultModel
  })()

  const selectorModelLabel = selectorModelOptions.find((model) => model.id === resolvedCurrentModelValue)?.label
    || currentModelOptions.find((model) => model.value === resolvedCurrentModelValue)?.label
    || resolvedCurrentModelValue

  const tokenFieldLabel = iaProvider === 'gemini'
    ? 'API Key (Google AI Studio)'
    : 'OpenRouter API Key'

  const tokenFieldPlaceholder = iaProvider === 'gemini'
    ? 'AIza...'
    : 'sk-or-...'

  const selectedLocalModel = localModels.find((model) => model.id === resolvedCurrentModelValue)
  const canTestSelectedProvider = iaProvider === 'local'
    ? Boolean(selectedLocalModel?.baixado && selectedLocalModel.download_status !== 'downloading')
    : selectedProviderAvailability.available

  /* --- IA sync effects --- */

  useEffect(() => {
    if (iaProvider === 'gemini') {
      const geminiToken = (providerConfigs?.gemini?.token || '').trim()
      const legacyValue = (iaForm.getValues('api_key') || '').trim()
      if (geminiToken !== legacyValue) {
        iaForm.setValue('api_key', geminiToken, { shouldDirty: false })
      }
    }
  }, [iaProvider, providerConfigs?.gemini?.token, iaForm])

  useEffect(() => {
    if (!resolvedCurrentModelValue) return
    const currentValue = (iaForm.getValues('modelo') || '').trim()
    if (currentValue !== resolvedCurrentModelValue) {
      iaForm.setValue('modelo', resolvedCurrentModelValue, { shouldDirty: false })
    }
    const providerModelPath = `provider_configs.${iaProvider}.modelo` as const
    const currentProviderModel = (iaForm.getValues(providerModelPath as any) || '').trim()
    if (currentProviderModel !== resolvedCurrentModelValue) {
      iaForm.setValue(providerModelPath as any, resolvedCurrentModelValue, { shouldDirty: false })
    }
  }, [iaForm, iaProvider, resolvedCurrentModelValue])

  useEffect(() => {
    if (iaProvider === 'openrouter' && !modelCatalogByProvider.openrouter && modelCatalogBusyProvider !== 'openrouter') {
      onCarregarCatalogoModelos('openrouter', false, true)
    }
    if (iaProvider === 'gemini' && !modelCatalogByProvider.gemini && modelCatalogBusyProvider !== 'gemini') {
      onCarregarCatalogoModelos('gemini', false, true)
    }
  }, [iaProvider, modelCatalogByProvider.openrouter, modelCatalogByProvider.gemini, modelCatalogBusyProvider])

  /* --- IA handlers --- */

  const buildIaConfigPayload = (rawValues?: any) => {
    const values = rawValues || iaForm.getValues()
    const provider = (values.provider || 'gemini') as IaProviderId
    const normalizedProviderConfigs = normalizeProviderConfigs(values.provider_configs, values)
    normalizedProviderConfigs[provider] = {
      ...normalizedProviderConfigs[provider],
      modelo: values.modelo || normalizedProviderConfigs[provider].modelo,
      ...(provider === 'gemini'
        ? { token: normalizedProviderConfigs.gemini.token || values.api_key || '' }
        : {}),
    }

    const activeCfg = normalizedProviderConfigs[provider]
    const apiKeyForCompat = provider === 'gemini'
      ? (normalizedProviderConfigs.gemini.token || values.api_key || '')
      : (activeCfg?.token || '')

    return {
      provider,
      api_key: apiKeyForCompat,
      modelo: values.modelo,
      provider_configs: normalizedProviderConfigs,
      provider_configs_json: JSON.stringify(normalizedProviderConfigs),
    }
  }

  const getCurrentProviderConfig = (provider: IaProviderId) => {
    const payload = buildIaConfigPayload()
    return (payload.provider_configs?.[provider] || {}) as IaProviderConfigForm
  }

  const onCarregarCatalogoModelos = async (provider: IaProviderId, forceRefresh = true, silent = false) => {
    setModelCatalogBusyProvider(provider)
    try {
      const res = await window.electron.ipcRenderer.invoke('ia.modelos.catalogo', {
        provider,
        provider_config: getCurrentProviderConfig(provider),
        force_refresh: forceRefresh,
      }) as IaModelCatalogResult

      setModelCatalogByProvider((prev) => ({ ...prev, [provider]: res }))
      if (provider === 'openrouter') {
        setOpenrouterTestedModelIds([])
      }

      if (!silent) {
        toast.success(`${IA_PROVIDER_LABELS[provider]}: ${res.models.length} modelos carregados (${res.source})`)
        if (res.message) toast.message(res.message)
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.message || `Erro ao carregar catalogo de modelos (${IA_PROVIDER_LABELS[provider]})`)
      }
    } finally {
      setModelCatalogBusyProvider(null)
    }
  }

  const onTestarModelosGratisOpenRouter = async () => {
    const providerCfg = getCurrentProviderConfig('openrouter')
    const token = (providerCfg?.token || '').trim()
    if (!token) {
      toast.error('Configure a OpenRouter API Key antes de testar os modelos gratuitos.')
      return
    }

    const freeModelIds = (remoteCatalog?.models || [])
      .filter((model) => model.is_free && model.id !== OPENROUTER_FREE_ROUTER_MODEL)
      .map((model) => model.id)

    if (freeModelIds.length === 0) {
      toast.message('Nenhum modelo gratuito elegivel para testar na lista atual.')
      return
    }

    setTestandoOpenrouterGratuitos(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('ia.openrouter.testarGratuitos', {
        provider_config: providerCfg,
        model_ids: freeModelIds,
      }) as IaOpenRouterFreeModelsTestResult

      setOpenrouterTestedModelIds(result.successful_model_ids)

      const currentFavorites = iaForm.getValues('provider_configs.openrouter.favoritos' as any) as string[] ?? []
      const mergedFavorites = Array.from(new Set([
        ...currentFavorites,
        ...result.successful_model_ids.filter((id) => id !== OPENROUTER_FREE_ROUTER_MODEL),
      ]))

      iaForm.setValue('provider_configs.openrouter.favoritos' as any, mergedFavorites, {
        shouldDirty: true,
      })

      if (result.success_count > 0) {
        toast.success(`${result.success_count} modelos gratuitos aprovados`, {
          description: `${result.tested_models} testados. Os aprovados foram disponibilizados no seletor.`,
        })
      } else {
        toast.warning('Nenhum modelo gratuito passou no teste.', {
          description: `${result.tested_models} modelos foram verificados.`,
        })
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar modelos gratuitos do OpenRouter.')
    } finally {
      setTestandoOpenrouterGratuitos(false)
    }
  }

  const onTestarIa = async () => {
    const payload = buildIaConfigPayload()
    setTestandoIa(true)
    try {
      const res = await window.electron.ipcRenderer.invoke('ia.configuracao.testar', payload)
      if (res.sucesso) {
        await reloadLocalModels()
        reloadIaCapabilities()
        window.dispatchEvent(new Event('ia-config-changed'))
        toast.success(res.mensagem || 'Conectado com sucesso!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar conexao.')
    } finally {
      setTestandoIa(false)
    }
  }

  const onSubmitIa = async (data: any) => {
    setSalvandoIa(true)
    try {
      const payload = buildIaConfigPayload(data)
      await window.electron.ipcRenderer.invoke('ia.configuracao.salvar', payload)
      reloadIaConfig()
      reloadIaCapabilities()
      iaForm.reset(buildIaFormValues(payload))
      window.dispatchEvent(new CustomEvent('ia-config-changed'))
      toast.success('Configuracoes de IA salvas.')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configuracoes.')
    } finally {
      setSalvandoIa(false)
    }
  }

  const onDownloadLocalModel = async (modelId: string) => {
    setLocalModelBusy(modelId)
    try {
      await window.electron.ipcRenderer.invoke('ia.local.download', { model_id: modelId })
      await reloadLocalModels()
      reloadIaCapabilities()
      window.dispatchEvent(new Event('ia-config-changed'))
      toast.info('Modelo local baixado. Validando carregamento agora...')
      await onValidateLocalModel(modelId)
    } catch (err: any) {
      await reloadLocalModels()
      reloadIaCapabilities()
      const message = err.message || 'Erro ao baixar modelo local.'
      if (message.includes('download em andamento')) {
        toast.info('Download ja esta em andamento.', {
          description: 'O progresso foi sincronizado no card do modelo.',
        })
      } else {
        toast.error(message)
      }
    } finally {
      setLocalModelBusy(null)
    }
  }

  const onValidateLocalModel = async (modelId: string) => {
    setLocalModelBusy(modelId)
    try {
      const values = iaForm.getValues()
      const providerConfigs = normalizeProviderConfigs(values.provider_configs, values)
      providerConfigs.local = {
        ...providerConfigs.local,
        modelo: modelId,
      }
      const res = await window.electron.ipcRenderer.invoke('ia.configuracao.testar', {
        provider: 'local',
        api_key: '',
        modelo: modelId,
        provider_configs_json: JSON.stringify(providerConfigs),
      })
      await reloadLocalModels()
      reloadIaCapabilities()
      window.dispatchEvent(new Event('ia-config-changed'))
      if (res.sucesso) toast.success(res.mensagem || 'Modelo local validado.')
    } catch (err: any) {
      await reloadLocalModels()
      reloadIaCapabilities()
      window.dispatchEvent(new Event('ia-config-changed'))
      toast.error(err.message || 'Modelo local falhou ao carregar.')
    } finally {
      setLocalModelBusy(null)
    }
  }

  const onCancelDownloadLocalModel = async () => {
    setLocalModelBusy(localModelDownloading?.id ?? 'download')
    try {
      await window.electron.ipcRenderer.invoke('ia.local.cancelDownload')
      await reloadLocalModels()
      reloadIaCapabilities()
      toast.success('Download cancelado.')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar download.')
    } finally {
      setLocalModelBusy(null)
    }
  }

  const onDeleteLocalModel = async (modelId: string) => {
    setLocalModelBusy(modelId)
    try {
      await window.electron.ipcRenderer.invoke('ia.local.deleteModel', { model_id: modelId })
      await reloadLocalModels()
      reloadIaCapabilities()
      window.dispatchEvent(new Event('ia-config-changed'))
      toast.success('Modelo local removido.')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover modelo local.')
    } finally {
      setLocalModelBusy(null)
    }
  }

  /* ---------- render ---------- */

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Configuracoes' }]}
      />

      <div className="flex flex-col gap-6 p-6">
        {/* 1. Aparencia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="size-4" />
              Aparencia
            </CardTitle>
            <CardDescription>Personalize o visual do sistema</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <h4 className="mb-1 text-sm font-medium">Modo</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Escolha entre claro, escuro ou automatico
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'system', label: 'Automatico', icon: Monitor },
                  { value: 'light', label: 'Claro', icon: Sun },
                  { value: 'dark', label: 'Escuro', icon: Moon },
                ].map(({ value, label, icon: Icon }) => {
                  const isSelected = currentMode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent',
                        isSelected && 'border-primary bg-accent'
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-sm">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="mb-1 text-sm font-medium">Cor do tema</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Escolha a paleta de cores da interface
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: 'zinc', label: 'Zinc', preview: 'hsl(222.2 47.4% 11.2%)' },
                  { value: 'blue', label: 'Azul', preview: 'hsl(221.2 83.2% 53.3%)' },
                  { value: 'violet', label: 'Violeta', preview: 'hsl(262.1 83.3% 57.8%)' },
                ].map(({ value, label, preview }) => {
                  const isSelected = colorTheme === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setColorTheme(value as 'zinc' | 'blue' | 'violet')}
                      className={cn(
                        'relative flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent',
                        isSelected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute right-2 top-2 size-4 text-primary" />
                      )}
                      <div className="flex gap-1">
                        <div
                          className="size-6 rounded-full border"
                          style={{ backgroundColor: 'hsl(var(--background))' }}
                        />
                        <div
                          className="size-6 rounded-full border"
                          style={{ backgroundColor: preview }}
                        />
                      </div>
                      <span className="text-sm">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Assistente IA */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="size-4" />
                Provedores de IA
              </CardTitle>
              <Badge variant="outline" className={iaStatusBadge.className}>
                {iaStatusBadge.label}
              </Badge>
              {iaProvider === 'local' && (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Beta
                </Badge>
              )}
            </div>
            <CardDescription>
              Credenciais e modelos por provider. A IA usada por cada parte do app fica em IA e Modelos.
              {chatRouteStatus?.message ? ` Chat: ${chatRouteStatus.message}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Form {...iaForm}>
              <form className="flex flex-col gap-6" onSubmit={iaForm.handleSubmit(onSubmitIa)}>
                <IaModelPill
                  variant="inline"
                  provider={iaProvider}
                  providerOptions={providerSelectorOptions}
                  modelo={resolvedCurrentModelValue}
                  modeloLabel={selectorModelLabel}
                  modelOptions={selectorModelOptions}
                  modelSelectDisabled={!selectedProviderAvailability.available}
                  onProviderChange={async (next) => {
                    const nextProvider = next as IaProviderId
                    const nextCfg = iaForm.getValues(`provider_configs.${nextProvider}` as any) as IaProviderConfigForm | undefined
                    const nextOptions = IA_PROVIDER_MODELS[nextProvider]
                    const nextModel =
                      nextCfg?.modelo && nextOptions.some((m) => m.value === nextCfg.modelo)
                        ? nextCfg.modelo
                        : nextOptions[0].value
                    iaForm.setValue('provider', nextProvider, { shouldDirty: true })
                    iaForm.setValue('modelo', nextModel, { shouldDirty: true })
                    if (nextProvider === 'gemini') {
                      iaForm.setValue('api_key', nextCfg?.token || '', { shouldDirty: false })
                    }
                  }}
                  onModeloChange={async (next) => {
                    if (iaProvider === 'local' && !usableLocalSet.has(next)) return
                    iaForm.setValue('modelo', next, { shouldDirty: true })
                    iaForm.setValue(`provider_configs.${iaProvider}.modelo` as any, next, {
                      shouldDirty: true,
                    })
                  }}
                />

                {/* API Key (cloud) or placeholder (local) */}
                {iaProvider === 'local' ? (
                  <div className="flex flex-col gap-3">
                    {localModels.map((model) => {
                      const isDownloading = model.download_status === 'downloading'
                      const progress = Math.max(0, Math.min(1, model.download_progresso ?? (
                        model.download_bytes_total
                          ? (model.download_bytes_feitos ?? 0) / model.download_bytes_total
                          : 0
                      )))
                      const badge = isDownloading
                        ? { label: `Baixando ${Math.round(progress * 100)}%`, variant: 'outline' as const }
                        : model.usable
                          ? { label: 'Pronto', variant: 'default' as const }
                          : model.load_error
                            ? { label: 'Falhou', variant: 'destructive' as const }
                            : model.baixado
                              ? { label: 'Precisa testar', variant: 'outline' as const }
                              : { label: 'Nao baixado', variant: 'outline' as const }

                      return (
                        <div key={model.id} className="flex flex-col gap-3 rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <WifiOff className="size-4 shrink-0 text-muted-foreground" />
                                <p className="truncate text-sm font-medium">{model.label}</p>
                                <Badge variant={badge.variant} className="text-xs">
                                  {badge.label}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatBytes(model.size_bytes)} · RAM {model.ram_minima_gb}GB+ · {model.descricao}
                              </p>
                              {isDownloading ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatBytes(model.download_bytes_feitos)} de {formatBytes(model.download_bytes_total)}
                                </p>
                              ) : null}
                              {model.load_error ? (
                                <p className="mt-2 text-xs text-destructive">
                                  Falhou ao carregar: {model.load_error}
                                </p>
                              ) : model.requires_validation ? (
                                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                  Arquivo baixado. Valide o carregamento antes de usar no chat ou CLI.
                                </p>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-wrap justify-end gap-2">
                              {isDownloading ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={localModelBusy === model.id || localModelBusy === 'download'}
                                  onClick={onCancelDownloadLocalModel}
                                >
                                  {localModelBusy === model.id || localModelBusy === 'download' ? <Loader2 className="animate-spin" /> : null}
                                  Cancelar
                                </Button>
                              ) : model.baixado ? (
                                <>
                                  {!model.usable ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={localModelBusy === model.id}
                                      onClick={() => onValidateLocalModel(model.id)}
                                    >
                                      {localModelBusy === model.id ? <Loader2 className="animate-spin" /> : <Play />}
                                      Testar
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={localModelBusy === model.id}
                                    onClick={() => onDeleteLocalModel(model.id)}
                                  >
                                    {localModelBusy === model.id ? <Loader2 className="animate-spin" /> : null}
                                    Remover
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={localModelBusy === model.id}
                                  onClick={() => onDownloadLocalModel(model.id)}
                                >
                                  {localModelBusy === model.id ? <Loader2 className="animate-spin" /> : <Download />}
                                  Baixar
                                </Button>
                              )}
                            </div>
                          </div>
                          {isDownloading ? (
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>{tokenFieldLabel}</Label>
                    {IA_PROVIDER_DOCS[iaProvider] && (
                    <a
                      href={IA_PROVIDER_DOCS[iaProvider]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Obter chave
                      <ExternalLink className="size-3" />
                    </a>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={tokenFieldPlaceholder}
                      value={(selectedProviderConfig.token ?? '') as string}
                      onChange={(e) => {
                        iaForm.setValue(`provider_configs.${iaProvider}.token` as any, e.target.value, {
                          shouldDirty: true,
                        })
                        if (iaProvider === 'gemini') {
                          iaForm.setValue('api_key', e.target.value, { shouldDirty: true })
                        }
                      }}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="size-4 text-muted-foreground" />
                      ) : (
                        <Eye className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                )}

                {/* OpenRouter model catalog picker */}
                {iaProvider === 'openrouter' && remoteCatalog?.models?.length ? (
                  <div className="flex flex-col gap-2">
                    <Label>Modelo</Label>
                    <IaModelCatalogPicker
                      models={remoteCatalog.models}
                      value={currentModelValue}
                      favorites={openrouterFavoritos}
                      defaultModelId={OPENROUTER_DEFAULT_MODEL}
                      testedModelIds={openrouterTestedModelIds}
                      testingFreeModels={testandoOpenrouterGratuitos}
                      onChange={(modelId) => {
                        iaForm.setValue('modelo', modelId, { shouldDirty: true })
                        iaForm.setValue('provider_configs.openrouter.modelo' as any, modelId, { shouldDirty: true })
                      }}
                      onToggleFavorite={(modelId) => {
                        const current = iaForm.getValues('provider_configs.openrouter.favoritos' as any) as string[] ?? []
                        const next = current.includes(modelId)
                          ? current.filter((id: string) => id !== modelId)
                          : [...current, modelId]
                        iaForm.setValue('provider_configs.openrouter.favoritos' as any, next, { shouldDirty: true })
                      }}
                      onBulkToggleFavorites={(ids, add) => {
                        const current = iaForm.getValues('provider_configs.openrouter.favoritos' as any) as string[] ?? []
                        const currentSet = new Set(current)
                        if (add) {
                          ids.forEach(id => currentSet.add(id))
                        } else {
                          ids.forEach(id => currentSet.delete(id))
                        }
                        iaForm.setValue('provider_configs.openrouter.favoritos' as any, [...currentSet], { shouldDirty: true })
                      }}
                      onTestFreeModels={onTestarModelosGratisOpenRouter}
                    />
                  </div>
                ) : null}

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => iaForm.reset()}
                    disabled={salvandoIa || !iaForm.formState.isDirty}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onTestarIa} disabled={testandoIa || !canTestSelectedProvider}>
                    {testandoIa ? <Loader2 className="animate-spin" /> : null}
                    Testar conexao
                  </Button>
                  <Button type="submit" size="sm" disabled={salvandoIa || !iaForm.formState.isDirty}>
                    {salvandoIa ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {iaForm.formState.isDirty ? 'Salvar' : 'Salvo'}
                  </Button>
                </div>
              </form>
            </Form>

            <AiRoutingSection />
          </CardContent>
        </Card>

        {/* 2b. Voz da Maiá */}
        <VozDaMaiaCard />

        {/* 3. Terminal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SquareTerminal className="size-4" />
              Terminal e CLI
            </CardTitle>
            <CardDescription>Chat IA validado no Terminal e shell local para comandos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Chat IA</Badge>
                  <span className="font-medium">Abrir conversa no Terminal</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Usa o provider/modelo escolhido em Assistente IA. O CLI faz preflight antes de aceitar mensagem.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={abrirCliFlowKit}>
                <SquareTerminal />
                Abrir chat CLI
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Shell local</Badge>
                    <span className="font-medium">Comandos do macOS</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aqui é terminal de comando. Texto livre vira comando shell.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pasta inicial do shell</Label>
                <Input
                  value={terminalConfig?.default_cwd ?? ''}
                  disabled={terminalSaving || !terminalConfig}
                  onChange={(event) => setTerminalConfig((prev) => prev ? { ...prev, default_cwd: event.target.value } : prev)}
                  onBlur={() => terminalConfig && saveTerminalPatch({ default_cwd: terminalConfig.default_cwd })}
                />
              </div>

              <Collapsible open={terminalAdvancedOpen} onOpenChange={setTerminalAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-muted-foreground hover:bg-transparent">
                    <ChevronDown className={cn('size-4 transition-transform', terminalAdvancedOpen && 'rotate-180')} />
                    Limites avançados do shell
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Timeout maximo (ms)</Label>
                      <Input
                        type="number"
                        min={100}
                        max={120000}
                        value={terminalConfig?.max_timeout_ms ?? 30000}
                        disabled={terminalSaving || !terminalConfig}
                        onChange={(event) => setTerminalConfig((prev) => prev ? { ...prev, max_timeout_ms: Number(event.target.value) } : prev)}
                        onBlur={() => terminalConfig && saveTerminalPatch({ max_timeout_ms: terminalConfig.max_timeout_ms })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Saída maxima (chars)</Label>
                      <Input
                        type="number"
                        min={1000}
                        max={200000}
                        value={terminalConfig?.max_output_chars ?? 20000}
                        disabled={terminalSaving || !terminalConfig}
                        onChange={(event) => setTerminalConfig((prev) => prev ? { ...prev, max_output_chars: Number(event.target.value) } : prev)}
                        onBlur={() => terminalConfig && saveTerminalPatch({ max_output_chars: terminalConfig.max_output_chars })}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        {/* 4. Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="size-4" />
              Backup
            </CardTitle>
            <CardDescription>Crie e restaure backups dos seus dados</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                Ultimo backup: {new Date(lastBackup).toLocaleString('pt-BR')}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={backupNowLoading || exportLoading}
                  >
                    {(backupNowLoading || exportLoading) ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {backupNowLoading ? 'Salvando...' : exportLoading ? 'Exportando...' : 'Criar backup'}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleBackupNow}>
                    <Save />
                    Backup Rapido
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportarCompleto}>
                    <Download />
                    Backup Completo...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportar}
                disabled={importLoading}
              >
                {importLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                Restaurar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 5. Processamento Automatico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Processamento Automatico
            </CardTitle>
            <CardDescription>Enriquecimento, grafo e limpeza executados periodicamente</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Enriquecer RAG após importação</p>
                  <p className="text-xs text-muted-foreground">
                    Usa o modelo escolhido abaixo para resumir chunks, tags e relações.
                  </p>
                </div>
                <Switch
                  checked={Boolean(enrichmentConfig?.auto_enrich_after_import)}
                  disabled={!enrichmentConfig || enrichmentSaving}
                  onCheckedChange={(checked: boolean) => saveEnrichmentPatch({ auto_enrich_after_import: checked })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Modelo de enrichment</p>
                  <p className="text-xs text-muted-foreground">
                    Automático tenta IA local primeiro e depois cloud disponível.
                  </p>
                </div>
                <Select
                  value={enrichmentConfig ? `${enrichmentConfig.provider}:${enrichmentConfig.modelo}` : 'auto:auto'}
                  disabled={!enrichmentConfig || enrichmentSaving}
                  onValueChange={(value: string) => {
                    if (value === 'auto:auto') {
                      saveEnrichmentPatch({ provider: 'auto' })
                      return
                    }
                    const [provider, ...modelParts] = value.split(':')
                    saveEnrichmentPatch({
                      provider: provider as KnowledgeEnrichmentConfig['provider'],
                      modelo: modelParts.join(':'),
                    })
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto:auto">Automático</SelectItem>
                    {enrichmentModels.map((model) => (
                      <SelectItem
                        key={`${model.provider}:${model.modelo}`}
                        value={`${model.provider}:${model.modelo}`}
                        disabled={!model.available}
                      >
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Processar ao iniciar o app</p>
                <p className="text-xs text-muted-foreground">
                  Executa automaticamente ao abrir e ao acordar do sleep
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const newVal = !cronAutoEnabled
                  setCronAutoEnabled(newVal)
                  try {
                    await client['config.set']({ key: 'cron_auto_enabled', value: JSON.stringify(newVal) })
                    toast.success(newVal ? 'Processamento automatico ativado' : 'Processamento automatico desativado')
                  } catch {
                    setCronAutoEnabled(!newVal)
                    toast.error('Erro ao salvar configuracao')
                  }
                }}
              >
                {cronAutoEnabled ? (
                  <ToggleRight className="size-5 text-green-500" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
                {cronAutoEnabled ? 'Ativado' : 'Desativado'}
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ultimo processamento:{' '}
                  {cronLastRun
                    ? new Date(cronLastRun).toLocaleString('pt-BR')
                    : 'Nunca executado'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={cronProcessando}
                onClick={async () => {
                  setCronProcessando(true)
                  try {
                    const result = await client['cron.executar']()
                    const steps = (result as any)?.steps_summary
                    toast.success('Processamento concluido!', {
                      description: steps
                        ? Object.entries(steps).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : undefined,
                    })
                    // Refresh status
                    const status = await client['cron.status']()
                    setCronLastRun(status.last_run)
                  } catch (err) {
                    toast.error('Erro no processamento', { description: (err as Error).message })
                  } finally {
                    setCronProcessando(false)
                  }
                }}
              >
                {cronProcessando ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Processar Agora
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 5. Sobre */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="size-4" />
              Sobre
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{APP_NAME}</span>
              {appVersion && (
                <Badge variant="outline" className="text-xs font-mono">
                  v{appVersion}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {APP_DESCRIPTION}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Aplicacao desktop para gestao de conhecimento pessoal com IA, RAG e Knowledge Graph.
            </p>
          </CardContent>
        </Card>
      </div>

      <DirtyGuardDialog
        blocker={blocker}
        onSaveAndExit={async () => {
          return new Promise<void>((resolve, reject) => {
            iaForm.handleSubmit((data) => onSubmitIa(data).then(resolve, reject), () => reject())()
          })
        }}
      />
    </div>
  )
}
