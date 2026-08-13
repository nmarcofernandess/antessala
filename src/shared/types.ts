import type { AiTerminalReadiness } from './ai-runtime-contract'

// ============================================================================
// ASSISTENTE DE IA
// ============================================================================

export interface IaContexto {
  rota: string
  pagina: 'dashboard' | 'memoria' | 'ia' | 'galeria' | 'terminal' | 'configuracoes' | 'outro' | 'externo'
  store_snapshot?: Record<string, any>  // StoreSnapshot from renderer
}

export interface ToolCall {
  id: string
  name: string
  // Optional because historical rows (and some fallback payloads) may contain only id/name.
  args?: Record<string, unknown>
  result?: unknown
}

export interface IaAnexo {
  id: string
  tipo: 'image' | 'file'
  mime_type: string
  nome: string
  tamanho_bytes: number
  data_base64?: string        // transient — renderer only, never persisted
  file_path?: string          // persisted — disk location relative to data dir
  preview_url?: string        // transient — blob URL for renderer
}

export type SttModelId = 'parakeet-v3-int8'

export interface SttModelCatalogItem {
  id: SttModelId
  label: string
  engine: 'parakeet'
  filename: string
  size_bytes: number
  ram_minima_gb: number
  languages: string[]
  supports_translation: boolean
  supports_language_hint: boolean
  notes: string
}

export interface SttModelStatus {
  id: SttModelId
  label: string
  baixado: boolean
  path: string
  source: 'bundled' | 'user' | 'missing'
  runtime_path: string
  install_path: string
  downloadable: boolean
  deletable: boolean
  size_bytes?: number
  notes: string
}

export interface SttStatus {
  disponivel: boolean
  active_model_id: SttModelId
  modelos: Record<SttModelId, SttModelStatus>
  sidecar_path: string
  sidecar_disponivel: boolean
  reason?: 'download_stt_model' | 'missing_sidecar'
}

export interface SttTranscriptResult {
  text: string
  raw_text: string
  model_id: SttModelId
  duration_ms: number
  audio_duration_ms: number
  language?: string
  segments?: Array<{ start_ms: number; end_ms: number; text: string }>
  post_processed: boolean
}

export interface SttPostProcessOptions {
  enabled: boolean
  mode: 'none' | 'clean_prompt' | 'formal_message'
  provider: 'configured_ia' | 'local_only'
}

export interface IaMensagem {
  id: string
  papel: 'usuario' | 'assistente' | 'tool_result'
  conteudo: string
  timestamp: string
  tool_calls?: ToolCall[]
  anexos?: IaAnexo[]
}

export interface IaConfiguracao {
  id: number
  provider: 'gemini' | 'openrouter'
  api_key: string
  modelo: string
  // JSON string with provider-specific settings (auth mode, token/login state, local CLI paths, etc).
  // Kept as raw string in DB shape for backward compatibility with existing queries.
  provider_configs_json?: string
  ativo: boolean
  memoria_automatica: boolean
  criado_em: string
  atualizado_em: string
}

export interface IaConversa {
  id: string
  titulo: string
  status: 'ativo' | 'arquivado'
  resumo_compactado?: string | null
  criado_em: string
  atualizado_em: string
}

export interface IaMensagemDB extends IaMensagem {
  conversa_id: string
}

export interface IaContextMeta {
  pagina?: string
  rota?: string
  bundle_sections: string[]
  briefing_chars: number
}

export type IaStreamEvent =
  | { type: 'context-meta'; stream_id: string; meta: IaContextMeta }
  | { type: 'text-delta'; stream_id: string; delta: string }
  | { type: 'tool-call-start'; stream_id: string; tool_call_id: string; tool_name: string; args: Record<string, unknown>; estimated_seconds?: number }
  | { type: 'tool-result'; stream_id: string; tool_call_id: string; tool_name: string; result: unknown }
  | { type: 'start-step'; stream_id: string; step_index: number }
  | { type: 'step-finish'; stream_id: string; step_index: number }
  | { type: 'follow-up-start'; stream_id: string }
  | { type: 'finish'; stream_id: string; resposta: string; acoes: ToolCall[] }
  | { type: 'error'; stream_id: string; message: string }

// ============================================================================
// MEMORIAS IA — fatos curtos, sempre injetados
// ============================================================================

export interface IaMemoria {
  id: number
  conteudo: string
  origem: 'manual' | 'auto'
  criada_em: string
  atualizada_em: string
}

// ============================================================================
// KNOWLEDGE LAYER — RAG + Knowledge Graph
// ============================================================================

export interface KnowledgeSource {
  id: number
  tipo: 'manual' | 'auto_capture' | 'sistema' | 'importacao_usuario' | 'importacao_conversa' | 'session'
  titulo: string
  conteudo_original: string
  group_id?: number | null
  metadata: Record<string, unknown>
  importance: 'high' | 'low'
  ativo: boolean
  criada_em: string
  atualizada_em: string
}

export interface KnowledgeChunk {
  id: number
  source_id: number
  conteudo: string
  importance: 'high' | 'low' | 'decayed'
  access_count: number
  last_accessed_at: string | null
  criada_em: string
  enriched_at?: string | null
  enrichment_json?: string | null
}

export interface KnowledgeEntity {
  id: number
  nome: string
  tipo: string
  origem: 'sistema' | 'usuario'
  valid_from: string
  valid_to: string | null
  criada_em: string
}

export interface KnowledgeRelation {
  id: number
  entity_from_id: number
  entity_to_id: number
  tipo_relacao: string
  peso: number
  valid_from: string
  valid_to: string | null
}

export type KnowledgeEnrichmentProvider = 'auto' | 'local' | 'gemini' | 'openrouter'

export interface KnowledgeEnrichmentConfig {
  auto_enrich_after_import: boolean
  provider: KnowledgeEnrichmentProvider
  modelo: string
  force_all_default: boolean
}

export interface KnowledgeEnrichmentModelOption {
  provider: Exclude<KnowledgeEnrichmentProvider, 'auto'>
  modelo: string
  label: string
  available: boolean
  reason?: string
}

export interface BulkRagImportInput {
  path: string
  group_name: string
  auto_enrich?: boolean
  auto_metadata?: boolean
  recursive?: boolean
  filters?: string[]
}

export interface BulkRagImportSummary {
  group_id: number
  import_job_id: number
  group_name: string
  root_path: string
  scanned_files: number
  imported_files: number
  skipped_files: number
  failed_files: number
  chunks_count: number
  conversations_count: number
  errors: Array<{ path: string; message: string }>
}

export interface KnowledgeGroup {
  id: number
  nome: string
  descricao: string | null
  origem: string
  metadata: Record<string, unknown>
  criada_em: string
  atualizada_em: string
}

export type KnowledgeImportJobStatus =
  | 'pending'
  | 'scanning'
  | 'importing'
  | 'embedding'
  | 'enriching'
  | 'paused'
  | 'done'
  | 'partial'
  | 'failed'
  | 'cancelled'

export interface KnowledgeImportJob {
  id: number
  group_id: number
  root_path: string
  recursive: boolean
  status: KnowledgeImportJobStatus
  total_files: number
  processed_files: number
  failed_files: number
  total_bytes: number
  processed_bytes: number
  chunks_created: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
}

export type KnowledgeImportFileStatus =
  | 'pending'
  | 'reading'
  | 'chunking'
  | 'embedding'
  | 'done'
  | 'failed'
  | 'skipped'

export interface KnowledgeImportFile {
  id: number
  job_id: number
  source_id: number | null
  path: string
  relative_path: string
  size_bytes: number
  mtime_ms: number
  sha256: string | null
  mime_type: string | null
  status: KnowledgeImportFileStatus
  error_message: string | null
}

// ============================================================================
// CATÁLOGO DE MODELOS IA
// ============================================================================

export type IaProviderId = 'gemini' | 'openrouter'

export interface IaLocalStatus {
  modelos: Record<string, {
    baixado: boolean
    tamanho_bytes: number
    tamanho_atual_bytes?: number
    usable?: boolean
    requires_validation?: boolean
    load_error?: string
    validated_at?: string
    download_status?: 'idle' | 'downloading' | 'cancelled' | 'failed' | 'done'
    download_progresso?: number
    download_bytes_total?: number
    download_bytes_feitos?: number
    download_error?: string
  }>
  modelo_ativo?: string
  modelo_carregado: boolean
  /** true = binário llama-server do bundle/runtime encontrado (modelo local é executável neste host) */
  server_binary_available?: boolean
  download_em_andamento?: string
  download_progresso?: number
  download_bytes_total?: number
  download_bytes_feitos?: number
  ram_modelo_mb?: number
  gpu_detectada?: string
  tokens_por_segundo?: number
}

export interface IaModelCatalogItem {
  id: string
  label: string
  provider: IaProviderId
  source: 'static' | 'api' | 'fallback'
  description?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  is_free?: boolean
  supports_tools?: boolean
  is_agentic?: boolean
  tags?: string[]
}

export interface IaModelCatalogResult {
  provider: IaProviderId
  source: 'static' | 'api' | 'fallback'
  models: IaModelCatalogItem[]
  fetched_at: string
  cached: boolean
  message?: string
}

export interface IaModelBatchFailure {
  id: string
  error: string
}

export interface IaOpenRouterFreeModelsTestResult {
  total_models: number
  tested_models: number
  success_count: number
  successful_model_ids: string[]
  failed_models: IaModelBatchFailure[]
}

export type IaCapabilityStatus =
  | 'unconfigured'
  | 'ready_cloud'
  | 'ready_local'
  | 'missing_cloud_token'
  | 'missing_local_model'
  | 'local_model_needs_validation'
  | 'local_model_error'

export interface IaCapabilityModel {
  id: string
  label: string
  available: boolean
  disabled: boolean
  reason?: string
}

export interface IaCapabilityProvider {
  provider: IaProviderId
  label: string
  available: boolean
  disabled: boolean
  reason?: string
  models: IaCapabilityModel[]
}

export interface IaCapabilities {
  provider: IaProviderId | null
  status: IaCapabilityStatus
  has_any_available_provider: boolean
  active_provider: IaProviderId | null
  active_provider_available: boolean
  show_unconfigured_state: boolean
  providers: IaCapabilityProvider[]
  can_chat: boolean
  can_test_connection: boolean
  can_load_remote_catalog: boolean
  can_use_cloud_llm_features: boolean
  /** false = chamadas @ai-sdk/google desligadas (OpenRouter/local seguem) */
  gemini_cloud_api_enabled: boolean
  /** true = binário llama-server presente; permite oferecer "Baixar IA local" no setup */
  local_server_binary_available?: boolean
  reason?: 'configure_provider' | 'configure_cloud_token' | 'download_local_model' | 'validate_local_model' | 'local_model_error'
  message: string
}

// ============================================================================
// JOBS LOCAIS
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'paused' | 'done' | 'partial' | 'failed' | 'cancelled'

export interface AppJob {
  id: string
  type: string
  label: string
  status: JobStatus
  progress: {
    total: number
    done: number
  }
  metadata: Record<string, unknown>
  error_message: string | null
  created_at: string
  updated_at: string
  finished_at: string | null
}

// ============================================================================
// TERMINAL HARNESS
// ============================================================================

export interface TerminalExecInput {
  command: string
  cwd?: string
  timeout_ms?: number
  max_output_chars?: number
  env?: Record<string, string>
}

export interface TerminalExecResult {
  command: string
  cwd: string
  exit_code: number | null
  signal: string | null
  stdout: string
  stderr: string
  duration_ms: number
  timed_out: boolean
  truncated?: boolean
}

export function isTerminalExecSuccess(result: Pick<TerminalExecResult, 'exit_code' | 'timed_out'>): boolean {
  return result.exit_code === 0 && !result.timed_out
}

export interface TerminalHarnessConfig {
  default_cwd: string
  max_timeout_ms: number
  max_output_chars: number
}

export type TerminalExecConfiguredResult = {
  status: 'ok' | 'error'
  result: TerminalExecResult
  config: TerminalHarnessConfig
  audit: {
    logged: boolean
    error?: string
  }
}

export interface TerminalOpenCliResult {
  opened: boolean
  command: string
  cwd: string
  status?: 'dispatched' | 'blocked' | 'failed'
  readiness?: AiTerminalReadiness
  error_message?: string
  wrapper_path?: string
}

export interface TerminalSessionInfo {
  id: string
  cwd: string
  shell: string
  status: 'running' | 'exited'
  created_at: string
  updated_at: string
  exit_code?: number | null
}

export interface TerminalSessionSnapshot extends TerminalSessionInfo {
  output: string
  truncated: boolean
}

// ─── Backup / Maquina do Tempo ────────────────────────────────

export interface ConfiguracaoBackup {
  pasta: string | null
  ativo: boolean
  backup_ao_fechar: boolean
  intervalo_horas: number
  max_snapshots: number
  ultimo_backup: string | null
}

export type SnapshotTrigger = 'auto_close' | 'auto_intervalo' | 'manual' | 'ia' | 'auto_pre_restore'
export type BackupScope = 'operational' | 'full'

export interface SnapshotMeta {
  app: string
  versao: string
  criado_em: string
  trigger: SnapshotTrigger
  tabelas: number
  registros: number
  scope?: BackupScope
}

export interface SnapshotInfo {
  filename: string
  meta: SnapshotMeta
  tamanho_bytes: number
}

// ============================================================================
// GALLERY
// ============================================================================

export interface GalleryImage {
  id: string
  file_path: string
  thumbnail_path: string | null
  nome_original: string
  origem: 'upload' | 'ai_generated' | 'extracted' | 'screenshot' | 'chat'
  tipo: string
  conversa_id: string | null
  source_id: number | null
  width: number | null
  height: number | null
  size_bytes: number | null
  mime_type: string | null
  ai_descricao: string | null
  ai_tags: string[] | null
  ai_confianca: number | null
  ai_provider: string | null
  analisado: boolean
  curtido: boolean
  favorito: boolean
  tags: string[]
  criada_em: string
  atualizada_em: string
}

// ============================================================================
// CRON
// ============================================================================

export interface CronStepResult {
  name: string
  status: 'ok' | 'skipped' | 'error'
  error?: string
}

export interface CronResult {
  status: 'processed' | 'skipped' | 'error'
  reason?: string
  steps: CronStepResult[]
  duracao_ms: number
}
