import { knowledgeClient } from './knowledge-client'
import type {
  AppJob,
  BulkRagImportInput,
  KnowledgeEnrichmentConfig,
  KnowledgeEnrichmentModelOption,
} from '@shared/types'

export const servicoConhecimento = {
  stats: () =>
    knowledgeClient['knowledge.stats']() as Promise<{
      fontes: Array<{
        id: number
        tipo: string
        titulo: string
        importance: string
        ativo: boolean
        criada_em: string
        atualizada_em: string
        chunks_count: number
      }>
      totais: {
        total_fontes: number
        total_chunks: number
        total_sistema: number
        total_usuario: number
      }
    }>,

  escolherArquivo: () => knowledgeClient['knowledge.escolherArquivo']() as Promise<string | null>,

  escolherPasta: () => knowledgeClient['knowledge.escolherPasta']() as Promise<string | null>,

  importar: (caminho_arquivo: string) =>
    knowledgeClient['knowledge.importar']({ caminho_arquivo }) as Promise<{ source_id: number; chunks_count: number; entities_count: number }>,

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
    knowledgeClient['knowledge.extrairTexto']({ caminho_arquivo }) as Promise<{ texto: string; nome_arquivo: string }>,

  metadataStatus: () => knowledgeClient['knowledge.metadataStatus']() as Promise<{
    available: boolean
    provider: 'gemini' | 'openrouter' | null
    model: string | null
    message: string
    action?: string
  }>,

  gerarMetadataIa: (texto: string, campo: 'titulo' | 'quando_consultar' | 'texto') =>
    knowledgeClient['knowledge.gerarMetadataIa']({ texto, campo }) as Promise<{ resultado: string }>,

  importarCompleto: (titulo: string, conteudo: string, quando_consultar: string, auto_enrich = true) =>
    knowledgeClient['knowledge.importarCompleto']({ titulo, conteudo, quando_consultar, auto_enrich }) as Promise<{
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

  carregarDemonstracao: () => knowledgeClient['knowledge.demo.seed']() as Promise<{
    imported: number
    sources_count: number
    source_ids: number[]
    fixture_version: string
  }>,

  enrich: () => knowledgeClient['knowledge.enrich']({}) as Promise<{
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

  graphData: (origem?: 'sistema' | 'usuario', limite?: number) =>
    knowledgeClient['knowledge.graphData']({ origem, limite }) as Promise<{
      nodes: Array<{ id: number; nome: string; tipo: string }>
      links: Array<{ source: number; target: number; tipo_relacao: string; peso: number }>
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

  async listarChunks(sourceId: number) {
    return (await knowledgeClient['knowledge.listarChunks']({ source_id: sourceId })) as Array<{
      id: number
      source_id: number
      conteudo: string
      importance: string
      last_accessed_at: string | null
      access_count: number
    }>
  },
}
