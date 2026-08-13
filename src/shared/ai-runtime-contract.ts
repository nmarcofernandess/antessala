export type AiRuntimeReadinessCode =
  | 'configMissing'
  | 'credentialMissing'
  | 'credentialInvalid'
  | 'providerUnreachable'
  | 'rateLimited'
  | 'modelDownloadRequired'
  | 'modelDownloading'
  | 'modelDownloadCanceled'
  | 'modelNeedsValidation'
  | 'modelLoadingFailed'
  | 'modelCorrupt'
  | 'cliMissing'
  | 'toolsUnavailable'
  | 'osUnsupported'
  | 'ready'

export type AiRuntimeUiAction =
  | 'openConfig'
  | 'downloadModel'
  | 'waitDownload'
  | 'retryDownload'
  | 'repairModel'
  | 'copyCommand'
  | 'launchTerminal'

export interface ResolvedAiRuntime {
  provider: 'gemini' | 'openrouter' | 'local' | null
  model: string | null
  displayName: string
  toolsAvailable: boolean
  toolsCount: number
  validatedAt: string | null
  validationTtlMs: number
}

export interface AiTerminalReadiness {
  ok: boolean
  code: AiRuntimeReadinessCode
  label: string
  message: string
  action: AiRuntimeUiAction
  blocksLaunch: boolean
  runtime: ResolvedAiRuntime
  command: string
  cwd: string
}

export const AI_RUNTIME_READINESS_COPY: Record<
  AiRuntimeReadinessCode,
  Omit<AiTerminalReadiness, 'runtime' | 'command' | 'cwd'>
> = {
  configMissing: {
    ok: false,
    code: 'configMissing',
    label: 'IA não configurada',
    message: 'Configure provider e modelo antes de abrir o Terminal.',
    action: 'openConfig',
    blocksLaunch: true,
  },
  credentialMissing: {
    ok: false,
    code: 'credentialMissing',
    label: 'IA precisa de credencial',
    message: 'Informe a API key/token do provider ativo.',
    action: 'openConfig',
    blocksLaunch: true,
  },
  credentialInvalid: {
    ok: false,
    code: 'credentialInvalid',
    label: 'Credencial inválida',
    message: 'A credencial foi recusada pelo provider.',
    action: 'openConfig',
    blocksLaunch: true,
  },
  providerUnreachable: {
    ok: false,
    code: 'providerUnreachable',
    label: 'Provider indisponível',
    message: 'Não foi possível validar o provider agora.',
    action: 'copyCommand',
    blocksLaunch: true,
  },
  rateLimited: {
    ok: false,
    code: 'rateLimited',
    label: 'Limite de uso atingido',
    message: 'O provider respondeu rate limit. Tente novamente mais tarde.',
    action: 'copyCommand',
    blocksLaunch: true,
  },
  modelDownloadRequired: {
    ok: false,
    code: 'modelDownloadRequired',
    label: 'Modelo local precisa baixar',
    message: 'Baixe o modelo local antes de abrir o Terminal.',
    action: 'downloadModel',
    blocksLaunch: true,
  },
  modelDownloading: {
    ok: false,
    code: 'modelDownloading',
    label: 'Download em progresso',
    message: 'Aguarde o download do modelo local terminar.',
    action: 'waitDownload',
    blocksLaunch: true,
  },
  modelDownloadCanceled: {
    ok: false,
    code: 'modelDownloadCanceled',
    label: 'Download cancelado',
    message: 'Retome ou reinicie o download do modelo local.',
    action: 'retryDownload',
    blocksLaunch: true,
  },
  modelNeedsValidation: {
    ok: false,
    code: 'modelNeedsValidation',
    label: 'Modelo local precisa validar',
    message: 'Valide o carregamento do modelo local antes de abrir o Terminal.',
    action: 'openConfig',
    blocksLaunch: true,
  },
  modelLoadingFailed: {
    ok: false,
    code: 'modelLoadingFailed',
    label: 'Modelo local com erro',
    message: 'O arquivo existe, mas o carregamento falhou.',
    action: 'repairModel',
    blocksLaunch: true,
  },
  modelCorrupt: {
    ok: false,
    code: 'modelCorrupt',
    label: 'Modelo local corrompido',
    message: 'O arquivo local parece incompleto ou inválido.',
    action: 'repairModel',
    blocksLaunch: true,
  },
  cliMissing: {
    ok: false,
    code: 'cliMissing',
    label: 'CLI não encontrado',
    message: 'O comando do CLI não está disponível neste build.',
    action: 'copyCommand',
    blocksLaunch: true,
  },
  toolsUnavailable: {
    ok: false,
    code: 'toolsUnavailable',
    label: 'Tools indisponíveis',
    message: 'A conversa não abre como Terminal IA sem ações de terminal/arquivos disponíveis.',
    action: 'copyCommand',
    blocksLaunch: true,
  },
  osUnsupported: {
    ok: false,
    code: 'osUnsupported',
    label: 'SO não suportado',
    message: 'Este sistema não tem abertura automática configurada. Use o comando manual.',
    action: 'copyCommand',
    blocksLaunch: true,
  },
  ready: {
    ok: true,
    code: 'ready',
    label: 'IA pronta',
    message: 'Provider, modelo, CLI e tools estão prontos para abrir no Terminal.',
    action: 'launchTerminal',
    blocksLaunch: false,
  },
}
