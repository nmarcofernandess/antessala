import { knowledgeClient } from './knowledge-client'
import type {
  AppJob,
  BulkRagImportInput,
  KnowledgeEnrichmentConfig,
  KnowledgeEnrichmentModelOption,
} from '@shared/types'
import type { StructuredDocumentImport } from '@shared/structured-document-import'
import type { RichTextJson } from '@/componentes/RichTextEditor'

export type KnowledgeDocument = {
  id: number
  titulo: string
  content_json: RichTextJson
  content_markdown: string
  plain_text: string
  source_format: string
  revision: number
  page_count: number | null
  word_count: number
  enrichment_status: 'pending' | 'indexing' | 'ready' | 'failed'
  atualizada_em: string
  metadata: Record<string, unknown>
}

export type KnowledgeDocumentVersion = {
  revision: number
  titulo: string
  content_json: RichTextJson
  content_markdown: string
  plain_text: string
  reason: string
  criada_em: string
}

export const servicoConhecimento = {
  stats: (query?: string) =>
    knowledgeClient['knowledge.stats']({ query }) as Promise<{
      fontes: Array<{
        id: number
        tipo: string
        titulo: string
        importance: string
        ativo: boolean
        criada_em: string
        atualizada_em: string
        source_format: string
        page_count: number | null
        word_count: number
        enrichment_status: 'pending' | 'indexing' | 'ready' | 'failed'
        chunks_count: number
      }>
      totais: {
        total_documentos: number
        total_conceitos: number
        total_relacoes: number
      }
    }>,

  obterDocumento: (id: number) =>
    knowledgeClient['knowledge.document.get']({ id }) as Promise<KnowledgeDocument>,

  salvarDocumento: (input: { id: number; expected_revision: number; titulo: string; content_json: RichTextJson }) =>
    knowledgeClient['knowledge.document.save'](input) as Promise<KnowledgeDocument>,

  listarVersoes: (id: number) =>
    knowledgeClient['knowledge.document.versions']({ id }) as Promise<KnowledgeDocumentVersion[]>,

  restaurarVersao: (id: number, revision: number, expected_revision: number) =>
    knowledgeClient['knowledge.document.restore']({ id, revision, expected_revision }) as Promise<KnowledgeDocument>,

  exportarMarkdown: (id: number) =>
    knowledgeClient['knowledge.document.exportMarkdown']({ id }) as Promise<{ saved: boolean; path?: string }>,

  escolherArquivo: () => knowledgeClient['knowledge.escolherArquivo']() as Promise<string | null>,

  escolherPasta: () => knowledgeClient['knowledge.escolherPasta']() as Promise<string | null>,

  iniciarBulkImport: (input: BulkRagImportInput) =>
    knowledgeClient['knowledge.bulkImport.start'](input) as Promise<AppJob>,

  listarJobs: () => knowledgeClient['jobs.list']() as Promise<{ jobs: AppJob[] }>,

  obterJob: (id: string) => knowledgeClient['jobs.get']({ id }) as Promise<{ job: AppJob | null }>,

  cancelarJob: (id: string) => knowledgeClient['jobs.cancel']({ id }) as Promise<{ job: AppJob }>,

  pausarJob: (id: string) => knowledgeClient['jobs.pause']({ id }) as Promise<{ job: AppJob }>,

  retomarJob: (id: string) => knowledgeClient['jobs.resume']({ id }) as Promise<{ job: AppJob }>,

  removerFonte: (id: number) =>
    knowledgeClient['knowledge.removerFonte']({ id }) as Promise<{ ok: boolean }>,

  toggleAtivo: (id: number, ativo: boolean) =>
    knowledgeClient['knowledge.toggleAtivo']({ id, ativo }) as Promise<{ ok: boolean }>,

  obterTextoOriginal: (id: number) =>
    knowledgeClient['knowledge.obterTextoOriginal']({ id }) as Promise<{ titulo: string; conteudo_original: string; context_hint: string | null }>,

  extrairTexto: (caminho_arquivo: string) =>
    knowledgeClient['knowledge.extrairTexto']({ caminho_arquivo }) as Promise<{
      document: StructuredDocumentImport
      sha256: string
    }>,

  metadataStatus: () => knowledgeClient['knowledge.metadataStatus']() as Promise<{
    available: boolean
    provider: 'gemini' | 'openrouter' | null
    model: string | null
    message: string
    action?: string
  }>,

  gerarMetadataIa: (texto: string, campo: 'titulo' | 'quando_consultar' | 'texto') =>
    knowledgeClient['knowledge.gerarMetadataIa']({ texto, campo }) as Promise<{ resultado: string }>,

  importarCompleto: (
    titulo: string,
    conteudo: string,
    quando_consultar: string,
    auto_enrich = true,
    structured_document?: StructuredDocumentImport,
    content_sha256?: string,
  ) =>
    knowledgeClient['knowledge.importarCompleto']({ titulo, conteudo, quando_consultar, auto_enrich, structured_document, content_sha256 }) as Promise<{
      source_id: number
      chunks_count: number
      entities_count: number
      enrichment: {
        status: 'completed' | 'skipped' | 'failed'
        reason?: string
        chunks_enriquecidos?: number
        entities_count?: number
        relations_count?: number
      }
    }>,

  enrichmentConfig: () =>
    knowledgeClient['knowledge.enrichmentConfig.get']() as Promise<KnowledgeEnrichmentConfig>,

  salvarEnrichmentConfig: (config: Partial<KnowledgeEnrichmentConfig>) =>
    knowledgeClient['knowledge.enrichmentConfig.save'](config) as Promise<KnowledgeEnrichmentConfig>,

  listarEnrichmentModels: () =>
    knowledgeClient['knowledge.enrichmentModels.list']() as Promise<KnowledgeEnrichmentModelOption[]>,

  enrich: (sourceId?: number) => knowledgeClient['knowledge.enrich']({ sourceId }) as Promise<{
    chunks_enriquecidos: number
    entities_count: number
    relations_count: number
    batches_processados: number
    batches_failed: number
    provider: 'gemini' | 'openrouter' | 'fixture'
    modelo: string
  }>,

  rebuildGraph: (origem: 'sistema' | 'usuario' = 'usuario') =>
    knowledgeClient['knowledge.rebuildGraph']({ origem }) as Promise<{ entities_count: number; relations_count: number; chunks_processados: number }>,

  graphStats: (origem?: 'sistema' | 'usuario') =>
    knowledgeClient['knowledge.graphStats']({ origem }) as Promise<{
      entities_count: number
      relations_count: number
      tipos: Array<{ tipo: string; count: number }>
    }>,

  /** DEV-ONLY: Rebuild sistema graph com LLM + export seed JSON */
  rebuildAndExportSistema: () =>
    knowledgeClient['knowledge.rebuildAndExportSistema']() as Promise<{
      entities_count: number
      relations_count: number
      chunks_processados: number
      seed_entities: number
      seed_relations: number
      exported_to: string
    }>,

  graphData: (origem?: 'sistema' | 'usuario', limite?: number, sourceId?: number, entityTypes?: string[]) =>
    knowledgeClient['knowledge.graphData']({ origem, limite, sourceId, entityTypes }) as Promise<{
      nodes: Array<{ id: number; nome: string; tipo: string }>
      links: Array<{ source: number; target: number; tipo_relacao: string; peso: number; evidence_count: number }>
    }>,

  graphNodeEvidence: (entityId: number) =>
    knowledgeClient['knowledge.graph.nodeEvidence']({ entityId }) as Promise<{
      entity: { id: number; nome: string; tipo: string; description: string }
      relations: Array<{
        relation_id: number
        tipo_relacao: string
        direction: 'entrada' | 'saida'
        neighbor_id: number
        neighbor_name: string
        neighbor_type: string
        source_id: number
        source_title: string
        source_revision: number
        section_ref: string
        excerpt: string | null
      }>
    }>,

  graphExplore: (entidade: string, profundidade?: number) =>
    knowledgeClient['knowledge.graphExplore']({ entidade, profundidade }) as Promise<{
      entidade_raiz: string | null
      entidades: Array<{ nome: string; tipo: string; nivel: number }>
      relacoes: Array<{ from_nome: string; to_nome: string; tipo_relacao: string; peso: number }>
    }>,

  async search(query: string, limite?: number) {
    return (await knowledgeClient['knowledge.search']({ query, limite })) as {
      chunks: Array<{
        id: number
        source_id: number
        conteudo: string
        importance: string
        score: number
        source_titulo: string
        source_tipo: string
        source_metadata: Record<string, unknown>
        last_accessed_at: string | null
        access_count: number
      }>
      relations: Array<{
        from_nome: string
        to_nome: string
        tipo_relacao: string
        peso: number
      }>
      total: number
    }
  },

}
