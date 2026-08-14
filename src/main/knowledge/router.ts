import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execute, insertReturningId, queryAll, queryOne } from '../db/query'
import {
  cancelJob,
  getJob,
  listJobs,
  pauseJob,
  resumeJob,
} from '../jobs'
import { buildModelFactory } from '../ia/config'
import {
  generateRagMetadata,
  generateRagTextCorrection,
  getKnowledgeCloudStatus,
} from '../ia/metadata-generator'
import { generateQueryEmbedding } from './embeddings'
import type {
  BulkRagImportInput,
  IaConfiguracao,
  IaMemoria,
  KnowledgeEnrichmentConfig,
} from '../../shared/types'

const require = createRequire(import.meta.url)
const { tipc } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')
const { BrowserWindow, dialog } = require('electron') as typeof import('electron')
const t = tipc.create()

const IA_MEMORIAS_LIMIT = 50

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

async function activeCloudFactory(feature: string) {
  const config = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
  if (!config || config.provider !== 'gemini') throw new Error(`${feature} requer Gemini configurado.`)
  const factory = buildModelFactory(config)
  if (!factory) throw new Error(`${feature} requer um token cloud válido.`)
  return { config, factory }
}

const iaConfigMemoriaAutomatica = t.procedure
  .input<{ valor?: boolean } | undefined>()
  .action(async ({ input }) => {
    if (input?.valor !== undefined) {
      await execute(
        'UPDATE configuracao_ia SET memoria_automatica = $1 WHERE id = 1',
        input.valor,
      )
    }
    const config = await queryOne<{ memoria_automatica: boolean }>(
      'SELECT memoria_automatica FROM configuracao_ia WHERE id = 1',
    )
    return { memoria_automatica: config?.memoria_automatica ?? false }
  })

const iaMemoriasListar = t.procedure.action(async () =>
  queryAll<IaMemoria>('SELECT * FROM ia_memorias ORDER BY atualizada_em DESC'),
)

const iaMemoriasSalvar = t.procedure
  .input<{ id?: number; conteudo: string }>()
  .action(async ({ input }) => {
    const conteudo = input.conteudo.trim()
    if (!conteudo) throw new Error('A memória não pode ficar vazia.')

    const embedding = await generateQueryEmbedding(conteudo)
    const embeddingJson = embedding ? JSON.stringify(embedding) : null

    if (input.id) {
      if (embeddingJson) {
        await execute(
          `UPDATE ia_memorias
             SET conteudo = $1, embedding = $2::vector, atualizada_em = NOW()
           WHERE id = $3`,
          conteudo,
          embeddingJson,
          input.id,
        )
      } else {
        await execute(
          'UPDATE ia_memorias SET conteudo = $1, atualizada_em = NOW() WHERE id = $2',
          conteudo,
          input.id,
        )
      }
      const updated = await queryOne<IaMemoria>('SELECT * FROM ia_memorias WHERE id = $1', input.id)
      if (!updated) throw new Error('Memória não encontrada.')
      return updated
    }

    const count = await queryOne<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM ia_memorias',
    )
    if ((count?.total ?? 0) >= IA_MEMORIAS_LIMIT) {
      throw new Error(`Limite de ${IA_MEMORIAS_LIMIT} memórias atingido.`)
    }

    const id = embeddingJson
      ? await insertReturningId(
          `INSERT INTO ia_memorias (conteudo, origem, embedding)
           VALUES ($1, 'manual', $2::vector)`,
          conteudo,
          embeddingJson,
        )
      : await insertReturningId(
          `INSERT INTO ia_memorias (conteudo, origem)
           VALUES ($1, 'manual')`,
          conteudo,
        )
    const created = await queryOne<IaMemoria>('SELECT * FROM ia_memorias WHERE id = $1', id)
    if (!created) throw new Error('Falha ao persistir memória.')
    return created
  })

const iaMemoriasRemover = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
    await execute('DELETE FROM ia_memorias WHERE id = $1', input.id)
  })

const iaMemoriasContar = t.procedure.action(async () => {
  const row = await queryOne<{ total: number }>('SELECT COUNT(*)::int AS total FROM ia_memorias')
  return { total: row?.total ?? 0, limite: IA_MEMORIAS_LIMIT }
})

const knowledgeListarFontes = t.procedure.action(async () =>
  queryAll(
    `SELECT id, tipo, titulo, importance, criada_em, atualizada_em
       FROM knowledge_sources
      ORDER BY atualizada_em DESC`,
  ),
)

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
    SELECT ks.id, ks.tipo, ks.titulo, ks.importance, ks.ativo,
           ks.criada_em, ks.atualizada_em, COUNT(kc.id)::int AS chunks_count
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
      (SELECT COUNT(*)::int FROM knowledge_sources) AS total_fontes,
      (SELECT COUNT(*)::int FROM knowledge_chunks) AS total_chunks,
      (SELECT COUNT(*)::int FROM knowledge_sources WHERE tipo = 'sistema') AS total_sistema,
      (SELECT COUNT(*)::int FROM knowledge_sources WHERE tipo <> 'sistema') AS total_usuario
  `)
  const enrichment = await queryOne<{
    enriched_count: number
    pending_count: number
    last_enriched_at: string | null
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE enriched_at IS NOT NULL) AS enriched_count,
      (SELECT COUNT(*)::int FROM knowledge_chunks WHERE enriched_at IS NULL) AS pending_count,
      (SELECT MAX(enriched_at)::text FROM knowledge_chunks) AS last_enriched_at
  `)
  return {
    fontes,
    totais: totais ?? {
      total_fontes: 0,
      total_chunks: 0,
      total_sistema: 0,
      total_usuario: 0,
    },
    enrichment: enrichment ?? {
      enriched_count: 0,
      pending_count: 0,
      last_enriched_at: null,
    },
  }
})

const knowledgeEscolherArquivo = t.procedure.action(async () => {
  const window = BrowserWindow.getFocusedWindow()
  const options = {
    properties: ['openFile' as const],
    filters: [{
      name: 'Documentos',
      extensions: ['md', 'markdown', 'txt', 'pdf', 'json', 'zip', 'html', 'htm', 'csv'],
    }],
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
})

const knowledgeEscolherPasta = t.procedure.action(async () => {
  const window = BrowserWindow.getFocusedWindow()
  const options = {
    properties: ['openDirectory' as const],
    title: 'Escolher pasta para importar no repositório de conhecimento',
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
})

const knowledgeImportar = t.procedure
  .input<{ caminho_arquivo: string }>()
  .action(async ({ input }) => {
    if (!existsSync(input.caminho_arquivo)) {
      throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
    }
    const { ingestFromFile } = await import('./ingest')
    return ingestFromFile(input.caminho_arquivo)
  })

const knowledgeBulkImportStart = t.procedure
  .input<BulkRagImportInput>()
  .action(async ({ input }) => {
    const { startBulkRagImport } = await import('./bulk-import')
    return startBulkRagImport(input)
  })

const jobsList = t.procedure.action(async () => ({ jobs: listJobs() }))
const jobsGet = t.procedure.input<{ id: string }>().action(async ({ input }) => ({
  job: getJob(input.id),
}))
const jobsCancel = t.procedure.input<{ id: string }>().action(async ({ input }) => ({
  job: cancelJob(input.id),
}))
const jobsPause = t.procedure.input<{ id: string }>().action(async ({ input }) => ({
  job: pauseJob(input.id),
}))
const jobsResume = t.procedure.input<{ id: string }>().action(async ({ input }) => ({
  job: resumeJob(input.id),
}))

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
      metadata: unknown
    }>(
      `SELECT titulo, conteudo_original, metadata
         FROM knowledge_sources
        WHERE id = $1`,
      input.id,
    )
    if (!row) throw new Error('Fonte não encontrada.')
    const metadata = parseMetadata(row.metadata)
    return {
      titulo: row.titulo,
      conteudo_original: row.conteudo_original,
      context_hint: typeof metadata.context_hint === 'string' ? metadata.context_hint : null,
    }
  })

const knowledgeExtrairTexto = t.procedure
  .input<{ caminho_arquivo: string }>()
  .action(async ({ input }) => {
    if (!existsSync(input.caminho_arquivo)) {
      throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
    }
    const { importFile } = await import('../importers/importer-registry')
    const result = await importFile(input.caminho_arquivo)
    if (result.type === 'error') throw new Error(result.error)

    const extension = path.extname(input.caminho_arquivo)
    const nome_arquivo = path.basename(input.caminho_arquivo, extension)
    if (result.type === 'conversations') {
      const conversations = result.data.conversations
      const preview = conversations
        .slice(0, 5)
        .map((conversation) => `- ${conversation.title} (${conversation.messages.length} msgs)`)
        .join('\n')
      return {
        texto: `${conversations.length} conversa(s) encontrada(s):\n\n${preview}`,
        nome_arquivo,
        tipo: 'conversations' as const,
        conversation_count: conversations.length,
      }
    }
    return { texto: result.data.text, nome_arquivo, tipo: 'text' as const }
  })

const knowledgeImportarArquivo = t.procedure
  .input<{ caminho_arquivo: string; titulo?: string }>()
  .action(async ({ input }) => {
    if (!existsSync(input.caminho_arquivo)) {
      throw new Error(`Arquivo não encontrado: ${input.caminho_arquivo}`)
    }
    const { ingestFromFile } = await import('./ingest')
    return ingestFromFile(input.caminho_arquivo, input.titulo)
  })

const metadataCache = new Map<string, {
  expiresAt: number
  promise: Promise<{ titulo: string; quando_consultar: string }>
}>()
const METADATA_CACHE_TTL_MS = 30_000

async function cachedMetadata(texto: string) {
  const status = await getKnowledgeCloudStatus()
  if (!status.available || !status.provider || !status.model) {
    throw new Error(status.message)
  }
  const key = `${status.provider}:${status.model}:${texto.length}:${texto.slice(0, 512)}:${texto.slice(-512)}`
  const now = Date.now()
  const cached = metadataCache.get(key)
  if (cached && cached.expiresAt > now) return cached.promise

  const promise = generateRagMetadata({
    texto,
    fileNameFallback: 'Documento importado',
  }).then(({ titulo, quando_consultar }) => ({ titulo, quando_consultar }))
  metadataCache.set(key, { expiresAt: now + METADATA_CACHE_TTL_MS, promise })
  promise.catch(() => metadataCache.delete(key))
  const timer = setTimeout(() => {
    if (metadataCache.get(key)?.promise === promise) metadataCache.delete(key)
  }, METADATA_CACHE_TTL_MS)
  timer.unref?.()
  return promise
}

const knowledgeMetadataStatus = t.procedure.action(getKnowledgeCloudStatus)

const knowledgeGerarMetadataIa = t.procedure
  .input<{ texto: string; campo: 'titulo' | 'quando_consultar' | 'texto' }>()
  .action(async ({ input }) => {
    if (input.campo === 'texto') {
      const result = await generateRagTextCorrection(input.texto)
      return { resultado: result.resultado }
    }
    const result = await cachedMetadata(input.texto)
    return { resultado: result[input.campo] }
  })

const knowledgeImportarCompleto = t.procedure
  .input<{ titulo: string; conteudo: string; quando_consultar: string }>()
  .action(async ({ input }) => {
    const { ingestKnowledge } = await import('./ingest')
    const conteudo = input.quando_consultar
      ? `<!-- quando_usar: ${input.quando_consultar} -->\n${input.conteudo}`
      : input.conteudo
    return ingestKnowledge(input.titulo, conteudo, 'high', {
      tipo: 'manual',
      context_hint: input.quando_consultar,
    })
  })

const knowledgeEnrich = t.procedure
  .input<{ sourceTipo?: string; bulkGroupId?: number; forceAll?: boolean } | undefined>()
  .action(async ({ input }) => {
    const { enrichAllChunksWithModel } = await import('./enrichment')
    const {
      buildKnowledgeEnrichmentModel,
      getKnowledgeEnrichmentConfig,
    } = await import('./enrichment-config')
    const config = await getKnowledgeEnrichmentConfig()
    const model = await buildKnowledgeEnrichmentModel(config, { explicitOverride: true })
    if (!model) {
      throw new Error('Configure o Gemini para enriquecer.')
    }
    return enrichAllChunksWithModel(model, {
      sourceTipo: input?.sourceTipo,
      bulkGroupId: input?.bulkGroupId,
      forceAll: input?.forceAll ?? config.force_all_default,
    })
  })

const knowledgeEnrichmentConfigGet = t.procedure.action(async () => {
  const { getKnowledgeEnrichmentConfig } = await import('./enrichment-config')
  return getKnowledgeEnrichmentConfig()
})

const knowledgeEnrichmentConfigSave = t.procedure
  .input<Partial<KnowledgeEnrichmentConfig>>()
  .action(async ({ input }) => {
    const { saveKnowledgeEnrichmentConfig } = await import('./enrichment-config')
    return saveKnowledgeEnrichmentConfig(input)
  })

const knowledgeEnrichmentModelsList = t.procedure.action(async () => {
  const { listKnowledgeEnrichmentModelOptions } = await import('./enrichment-config')
  return listKnowledgeEnrichmentModelOptions()
})

const knowledgeRebuildGraph = t.procedure
  .input<{ origem?: 'sistema' | 'usuario' } | undefined>()
  .action(async ({ input }) => {
    const { factory } = await activeCloudFactory('Rebuild do knowledge graph')
    const { rebuildGraph } = await import('./graph')
    return rebuildGraph(factory.createModel, factory.modelo, input?.origem ?? 'usuario')
  })

const knowledgeGraphStats = t.procedure
  .input<{ origem?: 'sistema' | 'usuario' } | undefined>()
  .action(async ({ input }) => {
    const { graphStats } = await import('./graph')
    return graphStats(input?.origem)
  })

const knowledgeRebuildAndExportSistema = t.procedure.action(async () => {
  if (process.env.NODE_ENV !== 'development' && !process.argv.includes('--dev')) {
    throw new Error('A exportação do graph seed só existe em desenvolvimento.')
  }
  const { factory } = await activeCloudFactory('Rebuild do knowledge graph do sistema')
  const { exportGraphSeed, rebuildGraph } = await import('./graph')
  const result = await rebuildGraph(factory.createModel, factory.modelo, 'sistema')
  const seed = await exportGraphSeed('sistema')
  const exportedTo = path.join(process.cwd(), 'knowledge', 'sistema', 'graph-seed.json')
  writeFileSync(exportedTo, JSON.stringify(seed, null, 2))
  return {
    ...result,
    seed_entities: seed.entities.length,
    seed_relations: seed.relations.length,
    exported_to: exportedTo,
  }
})

const knowledgeSearch = t.procedure
  .input<{ query: string; limite?: number }>()
  .action(async ({ input }) => {
    const { searchKnowledge } = await import('./search')
    const result = await searchKnowledge(input.query, { limite: input.limite ?? 10 })
    const chunks = await Promise.all(result.chunks.map(async (chunk) => {
      const source = await queryOne<{
        titulo: string
        tipo: string
        metadata: unknown
      }>(
        'SELECT titulo, tipo, metadata FROM knowledge_sources WHERE id = $1',
        chunk.source_id,
      )
      return {
        ...chunk,
        source_titulo: source?.titulo ?? 'Desconhecido',
        source_tipo: source?.tipo ?? 'manual',
        source_metadata: parseMetadata(source?.metadata),
      }
    }))
    return { chunks, relations: result.relations, total: chunks.length }
  })

const knowledgeListarChunks = t.procedure
  .input<{ source_id: number }>()
  .action(async ({ input }) => queryAll(
    `SELECT id, source_id, conteudo, importance,
            last_accessed_at::text, COALESCE(access_count, 0)::int AS access_count,
            enriched_at::text, enrichment_json
       FROM knowledge_chunks
      WHERE source_id = $1
      ORDER BY id`,
    input.source_id,
  ))

const knowledgeGraphData = t.procedure
  .input<{ origem?: 'sistema' | 'usuario'; limite?: number } | undefined>()
  .action(async ({ input }) => {
    const limite = input?.limite ?? 300
    const entities = input?.origem
      ? await queryAll<{ id: number; nome: string; tipo: string }>(
          `SELECT id, nome, tipo FROM knowledge_entities
            WHERE origem = $1 AND (valid_to IS NULL OR valid_to > NOW())
            ORDER BY criada_em DESC LIMIT $2`,
          input.origem,
          limite,
        )
      : await queryAll<{ id: number; nome: string; tipo: string }>(
          `SELECT id, nome, tipo FROM knowledge_entities
            WHERE valid_to IS NULL OR valid_to > NOW()
            ORDER BY criada_em DESC LIMIT $1`,
          limite,
        )
    const ids = entities.map((entity) => entity.id)
    if (ids.length === 0) return { nodes: [], links: [] }
    const links = await queryAll<{
      source: number
      target: number
      tipo_relacao: string
      peso: number
    }>(
      `SELECT entity_from_id AS source, entity_to_id AS target, tipo_relacao, peso
         FROM knowledge_relations
        WHERE entity_from_id = ANY($1::int[])
          AND entity_to_id = ANY($1::int[])
          AND (valid_to IS NULL OR valid_to > NOW())`,
      `{${ids.join(',')}}`,
    )
    return { nodes: entities, links }
  })

const knowledgeGraphExplore = t.procedure
  .input<{ entidade: string; profundidade?: number }>()
  .action(async ({ input }) => {
    const { exploreRelations } = await import('./search')
    return exploreRelations(input.entidade, input.profundidade ?? 2)
  })

/**
 * Router isolado atrás de um spread explícito. Registrá-lo disponibiliza os
 * contratos IPC, mas não cria rota, menu, job de boot ou chamada de rede.
 */
export const dormantKnowledgeRouter = {
  'ia.config.memoriaAutomatica': iaConfigMemoriaAutomatica,
  'ia.memorias.listar': iaMemoriasListar,
  'ia.memorias.salvar': iaMemoriasSalvar,
  'ia.memorias.remover': iaMemoriasRemover,
  'ia.memorias.contar': iaMemoriasContar,
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
  'knowledge.metadataStatus': knowledgeMetadataStatus,
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
  'jobs.list': jobsList,
  'jobs.get': jobsGet,
  'jobs.cancel': jobsCancel,
  'jobs.pause': jobsPause,
  'jobs.resume': jobsResume,
}

export type DormantKnowledgeRouter = typeof dormantKnowledgeRouter

/**
 * Superfície publicada do estúdio de conhecimento. Memória automática de
 * conversas e utilitários de exportação DEV continuam fora do router ativo.
 */
export const knowledgeStudioRouter = {
  'knowledge.stats': knowledgeStats,
  'knowledge.escolherArquivo': knowledgeEscolherArquivo,
  'knowledge.escolherPasta': knowledgeEscolherPasta,
  'knowledge.importar': knowledgeImportar,
  'knowledge.bulkImport.start': knowledgeBulkImportStart,
  'knowledge.removerFonte': knowledgeRemoverFonte,
  'knowledge.toggleAtivo': knowledgeToggleAtivo,
  'knowledge.obterTextoOriginal': knowledgeObterTextoOriginal,
  'knowledge.extrairTexto': knowledgeExtrairTexto,
  'knowledge.metadataStatus': knowledgeMetadataStatus,
  'knowledge.gerarMetadataIa': knowledgeGerarMetadataIa,
  'knowledge.importarCompleto': knowledgeImportarCompleto,
  'knowledge.enrich': knowledgeEnrich,
  'knowledge.enrichmentConfig.get': knowledgeEnrichmentConfigGet,
  'knowledge.enrichmentConfig.save': knowledgeEnrichmentConfigSave,
  'knowledge.enrichmentModels.list': knowledgeEnrichmentModelsList,
  'knowledge.rebuildGraph': knowledgeRebuildGraph,
  'knowledge.graphStats': knowledgeGraphStats,
  'knowledge.search': knowledgeSearch,
  'knowledge.listarChunks': knowledgeListarChunks,
  'knowledge.graphData': knowledgeGraphData,
  'knowledge.graphExplore': knowledgeGraphExplore,
  'jobs.list': jobsList,
  'jobs.get': jobsGet,
  'jobs.cancel': jobsCancel,
  'jobs.pause': jobsPause,
  'jobs.resume': jobsResume,
}

export type KnowledgeStudioRouter = typeof knowledgeStudioRouter
