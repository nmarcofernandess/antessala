import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execute, insertReturningId, queryAll, queryOne, transaction } from '../db/query'
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
import type { StructuredDocumentImport } from '../../shared/structured-document-import'

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

const knowledgeStats = t.procedure
  .input<{ query?: string } | undefined>()
  .action(async ({ input }) => {
  const query = input?.query?.trim() ?? ''
  const fontes = await queryAll<{
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
    enrichment_status: string
    chunks_count: number
  }>(`
    SELECT ks.id, ks.tipo, ks.titulo, ks.importance, ks.ativo,
           ks.criada_em::text, ks.atualizada_em::text, ks.source_format,
           ks.page_count, ks.word_count, ks.enrichment_status,
           (SELECT COUNT(*)::int FROM knowledge_chunks kc WHERE kc.source_id = ks.id) AS chunks_count
      FROM knowledge_sources ks
     WHERE ($1 = '' OR ks.titulo ILIKE '%' || $1 || '%'
       OR ks.conteudo_original ILIKE '%' || $1 || '%'
       OR ks.source_format ILIKE '%' || $1 || '%'
       OR COALESCE(ks.metadata->>'publisher', '') ILIKE '%' || $1 || '%')
     ORDER BY ks.atualizada_em DESC
  `, query)
  const totais = await queryOne<{
    total_documentos: number
    total_conceitos: number
    total_relacoes: number
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_sources) AS total_documentos,
      (SELECT COUNT(*)::int FROM knowledge_entities WHERE valid_to IS NULL OR valid_to > NOW()) AS total_conceitos,
      (SELECT COUNT(DISTINCT kr.id)::int
         FROM knowledge_relations kr
         JOIN knowledge_relation_evidence ev ON ev.relation_id = kr.id AND ev.invalidated_at IS NULL
        WHERE kr.valid_to IS NULL OR kr.valid_to > NOW()) AS total_relacoes
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
      total_documentos: 0,
      total_conceitos: 0,
      total_relacoes: 0,
    },
    enrichment: enrichment ?? {
      enriched_count: 0,
      pending_count: 0,
      last_enriched_at: null,
    },
  }
})

const knowledgeDocumentGet = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
    const { getKnowledgeDocument } = await import('./document-repository')
    return getKnowledgeDocument(input.id)
  })

const knowledgeDocumentSave = t.procedure
  .input<{ id: number; expected_revision: number; titulo: string; content_json: unknown }>()
  .action(async ({ input }) => {
    const { saveKnowledgeDocument } = await import('./document-repository')
    return saveKnowledgeDocument({ ...input, reason: 'autosave' })
  })

const knowledgeDocumentVersions = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
    const { listKnowledgeDocumentVersions } = await import('./document-repository')
    return listKnowledgeDocumentVersions(input.id)
  })

const knowledgeDocumentRestore = t.procedure
  .input<{ id: number; revision: number; expected_revision: number }>()
  .action(async ({ input }) => {
    const { restoreKnowledgeDocumentVersion } = await import('./document-repository')
    return restoreKnowledgeDocumentVersion(input)
  })

const knowledgeDocumentExportMarkdown = t.procedure
  .input<{ id: number }>()
  .action(async ({ input }) => {
    const { getKnowledgeDocument } = await import('./document-repository')
    const document = await getKnowledgeDocument(input.id)
    const options = {
      title: 'Exportar documento em Markdown',
      defaultPath: `${document.titulo.replace(/[^a-z0-9áàâãéêíóôõúç -]/gi, '').trim() || 'documento'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const result = focusedWindow
      ? await dialog.showSaveDialog(focusedWindow, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { saved: false as const }
    writeFileSync(result.filePath, document.content_markdown, 'utf8')
    return { saved: true as const, path: result.filePath }
  })

const knowledgeEscolherArquivo = t.procedure.action(async () => {
  const window = BrowserWindow.getFocusedWindow()
  const options = {
    properties: ['openFile' as const],
    filters: [{
      name: 'Documentos',
      extensions: ['pdf', 'docx', 'md', 'markdown', 'txt', 'html', 'htm', 'csv', 'json', 'jsonl'],
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
    await transaction(async () => {
      await execute(
        `DELETE FROM knowledge_relations kr
          WHERE EXISTS (
            SELECT 1 FROM knowledge_relation_evidence ev
             WHERE ev.relation_id = kr.id AND ev.source_id = $1
          )
            AND NOT EXISTS (
              SELECT 1 FROM knowledge_relation_evidence other
               WHERE other.relation_id = kr.id AND other.source_id <> $1
                 AND other.invalidated_at IS NULL
            )`,
        input.id,
      )
      await execute('DELETE FROM knowledge_sources WHERE id = $1', input.id)
    })
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
    const { importStructuredDocument } = await import('../importers/structured-document-importer')
    const document = await importStructuredDocument(input.caminho_arquivo)
    if (!document.text.trim() || document.warnings.some((warning) => warning.code === 'EMPTY_DOCUMENT')) {
      throw new Error('O documento não contém texto extraível. Se for um PDF escaneado, OCR é necessário.')
    }
    return {
      document,
      sha256: createHash('sha256').update(readFileSync(input.caminho_arquivo)).digest('hex'),
    }
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
  .input<{
    titulo: string
    conteudo?: string
    structured_document?: StructuredDocumentImport
    content_sha256?: string
    quando_consultar: string
    auto_enrich?: boolean
  }>()
  .action(async ({ input }) => {
    const { createKnowledgeDocument } = await import('./document-repository')
    const { countWords, markdownToRichText } = await import('./document-content')
    const fallbackText = input.conteudo?.trim() ?? ''
    const structuredDocument: StructuredDocumentImport = input.structured_document ?? {
      format: 'text',
      tiptapJson: markdownToRichText(fallbackText) as StructuredDocumentImport['tiptapJson'],
      markdown: fallbackText,
      text: fallbackText,
      suggestedTitle: input.titulo,
      pages: [{ number: 1, text: fallbackText, wordCount: countWords(fallbackText) }],
      wordCount: countWords(fallbackText),
      warnings: [],
      metadata: {
        fileName: `${input.titulo}.txt`,
        extension: '.txt',
        mimeType: 'text/plain',
        byteSize: Buffer.byteLength(fallbackText),
        modifiedAt: new Date().toISOString(),
        pageCount: 1,
        sourcePath: '',
      },
    }
    const created = await createKnowledgeDocument({
      titulo: input.titulo,
      document: structuredDocument,
      contextHint: input.quando_consultar,
      metadata: input.content_sha256 ? { content_sha256: input.content_sha256 } : {},
    })
    const imported = {
      source_id: created.source_id,
      chunks_count: created.index_count,
      entities_count: 0,
      revision: created.document.revision,
    }
    if (!input.auto_enrich) return { ...imported, enrichment: { status: 'skipped' as const } }

    try {
      const { enrichAllChunksWithModel } = await import('./enrichment')
      const { buildKnowledgeEnrichmentModel, getKnowledgeEnrichmentConfig } = await import('./enrichment-config')
      const config = await getKnowledgeEnrichmentConfig()
      const model = await buildKnowledgeEnrichmentModel(config, { explicitOverride: true })
      if (!model) {
        return { ...imported, enrichment: { status: 'skipped' as const, reason: 'Configure o Gemini para enriquecer automaticamente.' } }
      }
      const enrichment = await enrichAllChunksWithModel(model, { sourceId: imported.source_id })
      return { ...imported, enrichment: { status: 'completed' as const, ...enrichment } }
    } catch (error) {
      return {
        ...imported,
        enrichment: {
          status: 'failed' as const,
          reason: error instanceof Error ? error.message : String(error),
        },
      }
    }
  })

const knowledgeEnrich = t.procedure
  .input<{ sourceId?: number; sourceTipo?: string; bulkGroupId?: number; forceAll?: boolean } | undefined>()
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
      sourceId: input?.sourceId,
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
  .input<{ origem?: 'sistema' | 'usuario'; limite?: number; sourceId?: number; entityTypes?: string[] } | undefined>()
  .action(async ({ input }) => {
    const limite = input?.limite ?? 300
    const entities = input?.sourceId
      ? await queryAll<{ id: number; nome: string; tipo: string }>(
          `SELECT DISTINCT ke.id, ke.nome, ke.tipo
             FROM knowledge_entities ke
             JOIN knowledge_relations kr ON kr.entity_from_id = ke.id OR kr.entity_to_id = ke.id
             JOIN knowledge_relation_evidence ev ON ev.relation_id = kr.id AND ev.invalidated_at IS NULL
            WHERE ev.source_id = $1
              AND ($2::text IS NULL OR ke.origem = $2)
              AND (ke.valid_to IS NULL OR ke.valid_to > NOW())
            ORDER BY ke.nome LIMIT $3`,
          input.sourceId,
          input.origem ?? null,
          limite,
        )
      : input?.origem
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
      evidence_count: number
    }>(
      `SELECT kr.entity_from_id AS source, kr.entity_to_id AS target, kr.tipo_relacao,
              MAX(kr.peso) AS peso, COUNT(DISTINCT ev.id)::int AS evidence_count
         FROM knowledge_relations kr
         JOIN knowledge_relation_evidence ev ON ev.relation_id = kr.id AND ev.invalidated_at IS NULL
        WHERE kr.entity_from_id = ANY($1::int[])
          AND kr.entity_to_id = ANY($1::int[])
          AND (kr.valid_to IS NULL OR kr.valid_to > NOW())
          AND ($2::int IS NULL OR ev.source_id = $2)
        GROUP BY kr.entity_from_id, kr.entity_to_id, kr.tipo_relacao`,
      `{${ids.join(',')}}`,
      input?.sourceId ?? null,
    )
    return { nodes: entities, links }
  })

const knowledgeGraphNodeEvidence = t.procedure
  .input<{ entityId: number }>()
  .action(async ({ input }) => {
    const entity = await queryOne<{ id: number; nome: string; tipo: string }>(
      'SELECT id, nome, tipo FROM knowledge_entities WHERE id = $1',
      input.entityId,
    )
    if (!entity) throw new Error('Conceito não encontrado.')
    const relations = await queryAll<{
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
    }>(
      `SELECT kr.id AS relation_id, kr.tipo_relacao,
              CASE WHEN kr.entity_from_id = $1 THEN 'saida' ELSE 'entrada' END AS direction,
              neighbor.id AS neighbor_id, neighbor.nome AS neighbor_name, neighbor.tipo AS neighbor_type,
              ks.id AS source_id, ks.titulo AS source_title, ev.source_revision,
              ev.section_ref, ev.excerpt
         FROM knowledge_relations kr
         JOIN knowledge_entities neighbor ON neighbor.id = CASE
           WHEN kr.entity_from_id = $1 THEN kr.entity_to_id ELSE kr.entity_from_id END
         JOIN knowledge_relation_evidence ev ON ev.relation_id = kr.id AND ev.invalidated_at IS NULL
         JOIN knowledge_sources ks ON ks.id = ev.source_id AND ks.revision = ev.source_revision
        WHERE (kr.entity_from_id = $1 OR kr.entity_to_id = $1)
          AND (kr.valid_to IS NULL OR kr.valid_to > NOW())
        ORDER BY ks.titulo, ev.section_ref, neighbor.nome`,
      input.entityId,
    )
    return {
      entity: {
        ...entity,
        description: relations.find((relation) => relation.excerpt)?.excerpt
          ?? `Conceito sustentado por ${relations.length} ${relations.length === 1 ? 'evidência documental' : 'evidências documentais'}.`,
      },
      relations,
    }
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
  'knowledge.document.get': knowledgeDocumentGet,
  'knowledge.document.save': knowledgeDocumentSave,
  'knowledge.document.versions': knowledgeDocumentVersions,
  'knowledge.document.restore': knowledgeDocumentRestore,
  'knowledge.document.exportMarkdown': knowledgeDocumentExportMarkdown,
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
  'knowledge.graph.nodeEvidence': knowledgeGraphNodeEvidence,
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
  'knowledge.document.get': knowledgeDocumentGet,
  'knowledge.document.save': knowledgeDocumentSave,
  'knowledge.document.versions': knowledgeDocumentVersions,
  'knowledge.document.restore': knowledgeDocumentRestore,
  'knowledge.document.exportMarkdown': knowledgeDocumentExportMarkdown,
  'knowledge.escolherArquivo': knowledgeEscolherArquivo,
  'knowledge.escolherPasta': knowledgeEscolherPasta,
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
  'knowledge.graphData': knowledgeGraphData,
  'knowledge.graph.nodeEvidence': knowledgeGraphNodeEvidence,
  'knowledge.graphExplore': knowledgeGraphExplore,
  'jobs.list': jobsList,
  'jobs.get': jobsGet,
  'jobs.cancel': jobsCancel,
  'jobs.pause': jobsPause,
  'jobs.resume': jobsResume,
}

export type KnowledgeStudioRouter = typeof knowledgeStudioRouter
