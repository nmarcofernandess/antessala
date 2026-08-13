// ============================================================================
// ASSISTENTE DE IA
// ============================================================================

/** Contexto reservado para a futura reativação explícita da Memória/RAG. */
export interface IaContexto {
  rota: string
  pagina: 'dashboard' | 'memoria' | 'ia' | 'configuracoes' | 'outro' | 'externo'
  store_snapshot?: Record<string, unknown>
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
}

export interface IaConfiguracao {
  id: number
  provider: 'gemini' | 'openrouter'
  api_key: string
  modelo: string
  // JSON cru mantido por compatibilidade com as configurações já persistidas.
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

export type KnowledgeEnrichmentProvider = 'auto' | 'gemini' | 'openrouter'

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

export type IaProviderId = 'gemini' | 'openrouter'

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
