import { generateObject } from 'ai'
import { z } from 'zod'
import { queryAll, execute, queryOne, insertReturningId } from '../db/query'
import { generatePassageEmbedding } from './embeddings'

// =============================================================================
// SCHEMA — o que o LLM retorna pra cada chunk no batch
// =============================================================================

export const ChunkEnrichmentSchema = z.object({
  chunks: z.array(z.object({
    index: z.number().describe('Índice do chunk no batch (0-based)'),
    resumo: z.string().describe('Resumo em 1 frase clara do conteúdo do chunk'),
    tags: z.array(z.string()).describe('5-10 conceitos-chave incluindo sinônimos em português'),
    entidades: z.array(z.object({
      nome: z.string().describe('Nome canônico da entidade'),
      tipo: z.string().describe('Tipo da entidade (livre — ex: pessoa, projeto, tecnologia, conceito, documento, lugar, evento, empresa)'),
    })),
    relacoes: z.array(z.object({
      from: z.string().describe('Nome da entidade de origem'),
      to: z.string().describe('Nome da entidade de destino'),
      tipo_relacao: z.string().describe('Tipo da relacao (ex: usa, criou, depende_de, relacionado_a, parte_de, trabalha_com, implementa)'),
      peso: z.number().min(0).max(1).describe('1.0 = explícita, 0.5 = inferida'),
    })),
  })),
})

export type ChunkEnrichmentResult = z.infer<typeof ChunkEnrichmentSchema>

// =============================================================================
// CONFIG
// =============================================================================

const BATCH_SIZE = 10
const TIMEOUT_MS = 60_000 // 60s per batch (10 chunks)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

// =============================================================================
// PROMPT — batch enrichment
// =============================================================================

function buildBatchPrompt(
  chunks: Array<{ id: number; conteudo: string }>,
  sourceTitulo: string,
  sourceTipo: string,
  existingEntityNames: string[],
): string {
  const entityContext = existingEntityNames.length > 0
    ? `\nENTIDADES JÁ EXISTENTES NO GRAPH (use nomes canônicos quando possível):\n${existingEntityNames.join(', ')}\n`
    : ''

  const chunkBlocks = chunks.map((c, i) =>
    `=== CHUNK ${i} (id: ${c.id}) ===\n${c.conteudo}`
  ).join('\n\n')

  return `Você é um especialista em indexacao de conhecimento generico.

SOURCE: "${sourceTitulo}" (tipo: ${sourceTipo})
${entityContext}
Para CADA chunk abaixo, extraia:
1. **resumo**: 1 frase clara e descritiva do conteúdo
2. **tags**: 5-10 conceitos-chave em português, incluindo SINÔNIMOS e termos alternativos que alguém poderia usar para buscar este conteúdo (ex: se fala de "React", inclua também "frontend", "biblioteca UI", "componentes")
3. **entidades**: entidades mencionadas (nome canônico + tipo)
4. **relacoes**: relações explícitas entre entidades

REGRAS:
- Tags devem ser AMPLAS e inclusivas — pense em como diferentes pessoas buscariam este conteúdo
- Use nomes canônicos já existentes quando possível (veja lista acima)
- Não invente relações que não estão no texto
- peso 1.0 = explícita no texto, 0.5 = inferida pelo contexto

${chunkBlocks}`
}

// =============================================================================
// ENRICH BATCH — 1 LLM call pra N chunks
// =============================================================================

export interface EnrichmentModel {
  provider: 'gemini' | 'openrouter' | 'fixture'
  modelo: string
  generate: (prompt: string) => Promise<ChunkEnrichmentResult>
}

export interface EnrichmentResult {
  chunks_enriquecidos: number
  entities_count: number
  relations_count: number
  batches_processados: number
  batches_failed: number
  provider: EnrichmentModel['provider']
  modelo: string
}

export function createAiSdkEnrichmentModel(
  createModel: (modelo: string) => any,
  modelo: string,
  provider: 'gemini' | 'openrouter' = 'gemini',
): EnrichmentModel {
  return {
    provider,
    modelo,
    async generate(prompt: string) {
      const { object } = await withTimeout(
        generateObject({
          model: createModel(modelo),
          schema: ChunkEnrichmentSchema,
          prompt,
        }),
        TIMEOUT_MS,
        `enrichment ${modelo}`,
      )
      return object
    },
  }
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

function normalizeJsonLikeOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

export function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(normalizeJsonLikeOutput(cleaned))
  } catch (err) {
    const balanced = extractBalancedJsonObject(cleaned)
    if (balanced) {
      try {
        return JSON.parse(normalizeJsonLikeOutput(balanced))
      } catch {
        // Preserve the original parser error below; it is usually more precise.
      }
    }
    throw new Error(`Modelo nao retornou JSON valido: ${(err as Error).message}`)
  }
}

async function enrichBatch(
  chunks: Array<{ id: number; conteudo: string }>,
  sourceTitulo: string,
  sourceTipo: string,
  existingEntityNames: string[],
  enrichmentModel: EnrichmentModel,
): Promise<ChunkEnrichmentResult> {
  try {
    const prompt = buildBatchPrompt(chunks, sourceTitulo, sourceTipo, existingEntityNames)
    console.log(`[enrichment]   → chamando ${enrichmentModel.provider} (${enrichmentModel.modelo}) com ${prompt.length} chars...`)
    const result = await enrichmentModel.generate(prompt)
    console.log(`[enrichment]   ✓ LLM retornou ${result.chunks.length} chunks enriquecidos`)
    return result
  } catch (err) {
    console.error(`[enrichment]   ✗ Batch FALHOU (${chunks.length} chunks):`, (err as Error).message)
    return { chunks: [] }
  }
}

// =============================================================================
// APPLY — atualiza chunk no DB + re-embed + graph
// =============================================================================

async function applyEnrichmentToChunk(
  chunkId: number,
  original: string,
  enrichment: ChunkEnrichmentResult['chunks'][0],
): Promise<void> {
  // 1. Construir texto enriquecido pra embedding
  const tagsStr = enrichment.tags.join(', ')
  const enrichedText = `[Resumo: ${enrichment.resumo}]\n[Tags: ${tagsStr}]\n\n${original}`

  // 2. Metadata do enrichment (pra display no inspector)
  const enrichmentData = JSON.stringify({
    resumo: enrichment.resumo,
    tags: enrichment.tags,
    entidades: enrichment.entidades.length,
    relacoes: enrichment.relacoes.length,
  })

  // 3. Gerar novo embedding do texto enriquecido
  const embedding = await generatePassageEmbedding(enrichedText)
  const embeddingJson = embedding ? JSON.stringify(embedding) : null

  // 4. Atualizar chunk: embedding + search_tsv + enrichment_json + enriched_at
  if (embeddingJson) {
    await execute(
      `UPDATE knowledge_chunks
       SET embedding = $1::vector,
           search_tsv = to_tsvector('portuguese', $2),
           enrichment_json = $3,
           enriched_at = NOW()
       WHERE id = $4`,
      embeddingJson,
      enrichedText,
      enrichmentData,
      chunkId,
    )
  } else {
    await execute(
      `UPDATE knowledge_chunks
       SET search_tsv = to_tsvector('portuguese', $1),
           enrichment_json = $2,
           enriched_at = NOW()
       WHERE id = $3`,
      enrichedText,
      enrichmentData,
      chunkId,
    )
  }
}

async function persistEnrichmentGraph(
  allEntities: Array<{ nome: string; tipo: string }>,
  allRelations: Array<{
    from: string
    to: string
    tipo_relacao: string
    peso: number
    section_ref?: string
    excerpt?: string
  }>,
  origem: 'sistema' | 'usuario',
  evidence?: { sourceId: number; sourceRevision: number },
): Promise<{ entities_count: number; relations_count: number }> {
  // Dedup entities
  const entityMap = new Map<string, { nome: string; tipo: string }>()
  for (const e of allEntities) {
    const key = `${e.nome.toLowerCase()}::${e.tipo.toLowerCase()}`
    if (!entityMap.has(key)) entityMap.set(key, { nome: e.nome, tipo: e.tipo.toLowerCase() })
  }

  // Dedup relations
  const relationMap = new Map<string, typeof allRelations>()
  for (const r of allRelations) {
    const key = `${r.from.toLowerCase()}::${r.to.toLowerCase()}::${r.tipo_relacao.toLowerCase()}`
    const values = relationMap.get(key) ?? []
    values.push({ ...r, tipo_relacao: r.tipo_relacao.toLowerCase() })
    relationMap.set(key, values)
  }

  // Persist entities with embeddings
  const entityIdMap = new Map<string, number>()
  for (const e of entityMap.values()) {
    const embedding = await generatePassageEmbedding(e.nome)
    const embeddingJson = embedding ? JSON.stringify(embedding) : null

    let id: number | undefined
    if (embeddingJson) {
      id = await insertReturningId(
        `INSERT INTO knowledge_entities (nome, tipo, embedding, origem)
         VALUES ($1, $2, $3::vector, $4)
         ON CONFLICT (nome, tipo) DO UPDATE SET embedding = EXCLUDED.embedding
         RETURNING id`,
        e.nome, e.tipo, embeddingJson, origem,
      )
    } else {
      id = await insertReturningId(
        `INSERT INTO knowledge_entities (nome, tipo, origem)
         VALUES ($1, $2, $3)
         ON CONFLICT (nome, tipo) DO NOTHING
         RETURNING id`,
        e.nome, e.tipo, origem,
      )
      if (!id) {
        const existing = await queryOne<{ id: number }>(
          'SELECT id FROM knowledge_entities WHERE nome = $1 AND tipo = $2', e.nome, e.tipo,
        )
        if (existing) id = existing.id
      }
    }
    if (id) entityIdMap.set(e.nome.toLowerCase(), id)
  }

  // Persist relations
  let relationsInserted = 0
  for (const relationEvidence of relationMap.values()) {
    const r = relationEvidence.reduce((best, candidate) => candidate.peso > best.peso ? candidate : best)
    const fromId = entityIdMap.get(r.from.toLowerCase())
    const toId = entityIdMap.get(r.to.toLowerCase())
    if (!fromId || !toId || fromId === toId) continue
    const existing = await queryOne<{ id: number; peso: number }>(
      `SELECT id, peso FROM knowledge_relations
        WHERE entity_from_id = $1 AND entity_to_id = $2 AND tipo_relacao = $3
          AND (valid_to IS NULL OR valid_to > NOW())
        ORDER BY id LIMIT 1`,
      fromId,
      toId,
      r.tipo_relacao,
    )
    let relationId = existing?.id ?? 0
    if (relationId) {
      if (r.peso > Number(existing?.peso ?? 0)) {
        await execute('UPDATE knowledge_relations SET peso = $1 WHERE id = $2', r.peso, relationId)
      }
    } else {
      relationId = await insertReturningId(
        `INSERT INTO knowledge_relations (entity_from_id, entity_to_id, tipo_relacao, peso)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        fromId, toId, r.tipo_relacao, r.peso,
      )
      relationsInserted += relationId ? 1 : 0
    }
    if (relationId && evidence) {
      for (const item of relationEvidence) {
        await execute(
          `INSERT INTO knowledge_relation_evidence (
             relation_id, source_id, source_revision, section_ref, excerpt
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (relation_id, source_id, source_revision, section_ref)
           DO UPDATE SET excerpt = EXCLUDED.excerpt, invalidated_at = NULL`,
          relationId,
          evidence.sourceId,
          evidence.sourceRevision,
          item.section_ref ?? 'Documento',
          item.excerpt ?? null,
        )
      }
    }
  }

  return { entities_count: entityIdMap.size, relations_count: relationsInserted }
}

// =============================================================================
// MAIN — enrichAllChunks
// =============================================================================

export interface EnrichmentProgress {
  fase: 'carregando' | 'enriquecendo' | 'aplicando' | 'graph' | 'concluido'
  batch_atual?: number
  total_batches?: number
  chunks_enriquecidos?: number
  entities_count?: number
  relations_count?: number
}

export interface EnrichmentOptions {
  /** Restringe o processamento a uma única fonte recém-importada. */
  sourceId?: number
  /** Filtro por tipo de source: 'sistema', 'manual', 'importacao_usuario', etc. Se omitido, processa todos. */
  sourceTipo?: string
  /** Filtro por grupo de importacao em massa. */
  bulkGroupId?: string | number
  /** Se true, re-enriquece chunks já enriquecidos. Default: false (só processa novos). */
  forceAll?: boolean
}

export async function enrichAllChunks(
  createModel: (modelo: string) => any,
  modelo: string,
  options?: EnrichmentOptions,
  onProgress?: (p: EnrichmentProgress) => void,
): Promise<EnrichmentResult> {
  return enrichAllChunksWithModel(createAiSdkEnrichmentModel(createModel, modelo), options, onProgress)
}

export async function enrichAllChunksWithModel(
  enrichmentModel: EnrichmentModel,
  options?: EnrichmentOptions,
  onProgress?: (p: EnrichmentProgress) => void,
): Promise<EnrichmentResult> {
  onProgress?.({ fase: 'carregando' })

  // 1. Carregar chunks agrupados por source
  const params: unknown[] = []
  const sourceIdFilter = options?.sourceId ? `AND ks.id = $${params.push(options.sourceId)}` : ''
  const tipoFilter = options?.sourceTipo ? `AND ks.tipo = $${params.push(options.sourceTipo)}` : ''
  let bulkGroupFilter = ''
  if (options?.bulkGroupId) {
    const groupValue = String(options.bulkGroupId)
    const numericGroupId = /^\d+$/.test(groupValue) ? Number(groupValue) : null
    if (numericGroupId) {
      params.push(numericGroupId)
      const groupParam = params.length
      params.push(groupValue)
      const metadataParam = params.length
      bulkGroupFilter = `AND (ks.group_id = $${groupParam} OR ks.metadata->>'bulk_group_id' = $${metadataParam})`
    } else {
      bulkGroupFilter = `AND ks.metadata->>'bulk_group_id' = $${params.push(groupValue)}`
    }
  }
  const enrichedFilter = options?.forceAll ? '' : 'AND kc.enriched_at IS NULL'

  const chunks = await queryAll<{
    chunk_id: number
    conteudo: string
    source_id: number
    source_titulo: string
    source_tipo: string
    source_revision: number
  }>(`
    SELECT kc.id AS chunk_id, kc.conteudo, ks.id AS source_id, ks.titulo AS source_titulo,
           ks.tipo AS source_tipo, ks.revision AS source_revision
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON ks.id = kc.source_id AND ks.ativo = true
    WHERE length(kc.conteudo) > 50
      ${tipoFilter}
      ${sourceIdFilter}
      ${bulkGroupFilter}
      ${enrichedFilter}
    ORDER BY ks.tipo, ks.id, kc.id
  `, ...params)

  if (chunks.length === 0) {
    onProgress?.({ fase: 'concluido', chunks_enriquecidos: 0, entities_count: 0, relations_count: 0 })
    return {
      chunks_enriquecidos: 0,
      entities_count: 0,
      relations_count: 0,
      batches_processados: 0,
      batches_failed: 0,
      provider: enrichmentModel.provider,
      modelo: enrichmentModel.modelo,
    }
  }

  // 2. Carregar entidades existentes pra contexto do LLM
  const existingEntities = await queryAll<{ nome: string }>(
    `SELECT DISTINCT nome FROM knowledge_entities WHERE valid_to IS NULL OR valid_to > NOW()`
  )
  const existingEntityNames = existingEntities.map(e => e.nome)

  // 3. Agrupar por source pra manter contexto sequencial
  const sourceGroups = new Map<number, typeof chunks>()
  for (const c of chunks) {
    const group = sourceGroups.get(c.source_id) ?? []
    group.push(c)
    sourceGroups.set(c.source_id, group)
  }

  // 4. Criar batches de ~BATCH_SIZE, respeitando fronteiras de source
  const batches: Array<{
    chunks: Array<{ id: number; conteudo: string }>
    sourceTitulo: string
    sourceTipo: string
    sourceId: number
    sourceRevision: number
  }> = []

  for (const [, group] of sourceGroups) {
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      const slice = group.slice(i, i + BATCH_SIZE)
      batches.push({
        chunks: slice.map(c => ({ id: c.chunk_id, conteudo: c.conteudo })),
        sourceTitulo: slice[0].source_titulo,
        sourceTipo: slice[0].source_tipo,
        sourceId: slice[0].source_id,
        sourceRevision: Number(slice[0].source_revision),
      })
    }
  }

  console.log(`[enrichment] ══════════════════════════════════════════════`)
  console.log(`[enrichment] INICIO: ${chunks.length} chunks em ${batches.length} batches (${sourceGroups.size} sources)`)
  console.log(`[enrichment] Modelo: ${enrichmentModel.provider}/${enrichmentModel.modelo}`)
  console.log(`[enrichment] Entidades existentes no graph: ${existingEntityNames.length}`)
  console.log(`[enrichment] ══════════════════════════════════════════════`)

  // 5. Processar batches
  let totalEnriched = 0
  let batchesFailed = 0
  const failedSources = new Set<number>()
  const graphBySource = new Map<number, {
    revision: number
    tipo: string
    entities: Array<{ nome: string; tipo: string }>
    relations: Array<{ from: string; to: string; tipo_relacao: string; peso: number; section_ref: string; excerpt: string }>
  }>()

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    if (!graphBySource.has(batch.sourceId)) {
      graphBySource.set(batch.sourceId, {
        revision: batch.sourceRevision,
        tipo: batch.sourceTipo,
        entities: [],
        relations: [],
      })
    }
    console.log(`[enrichment] batch ${b + 1}/${batches.length} (${batch.chunks.length} chunks de "${batch.sourceTitulo}")`)
    onProgress?.({ fase: 'enriquecendo', batch_atual: b + 1, total_batches: batches.length })

    const result = await enrichBatch(
      batch.chunks,
      batch.sourceTitulo,
      batch.sourceTipo,
      existingEntityNames,
      enrichmentModel,
    )

    if (result.chunks.length === 0) {
      batchesFailed++
      failedSources.add(batch.sourceId)
      console.warn(`[enrichment]   ⚠ batch ${b + 1} retornou 0 chunks (falha LLM ou timeout)`)
      continue
    }

    // 6. Aplicar enriquecimento chunk a chunk
    onProgress?.({ fase: 'aplicando', batch_atual: b + 1, total_batches: batches.length })

    for (const enriched of result.chunks) {
      const originalChunk = batch.chunks[enriched.index]
      if (!originalChunk) continue

      await applyEnrichmentToChunk(originalChunk.id, originalChunk.conteudo, enriched)
      totalEnriched++

      // Acumular graph data
      const graph = graphBySource.get(batch.sourceId)!
      graph.entities.push(...enriched.entidades)
      const firstLine = originalChunk.conteudo.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim() || 'Documento'
      graph.relations.push(...enriched.relacoes.map((relation) => ({
        ...relation,
        section_ref: firstLine.slice(0, 180),
        excerpt: originalChunk.conteudo.slice(0, 500),
      })))
      graphBySource.set(batch.sourceId, graph)

      // Adicionar novas entidades ao contexto pra próximos batches
      for (const e of enriched.entidades) {
        if (!existingEntityNames.includes(e.nome)) {
          existingEntityNames.push(e.nome)
        }
      }
    }
  }

  // 7. Persistir graph acumulado
  onProgress?.({ fase: 'graph' })
  const graphResult = { entities_count: 0, relations_count: 0 }
  for (const [sourceId, graph] of graphBySource) {
    const current = await queryOne<{ revision: number }>(
      'SELECT revision FROM knowledge_sources WHERE id = $1',
      sourceId,
    )
    if (!current || Number(current.revision) !== graph.revision) {
      console.warn(`[enrichment] descartando resultado atrasado da fonte ${sourceId}, revisão ${graph.revision}`)
      continue
    }
    console.log(`[enrichment] persistindo graph da fonte ${sourceId}: ${graph.entities.length} entidades, ${graph.relations.length} relações`)
    const persisted = graph.entities.length > 0
      ? await persistEnrichmentGraph(
          graph.entities,
          graph.relations,
          graph.tipo === 'sistema' ? 'sistema' : 'usuario',
          { sourceId, sourceRevision: graph.revision },
        )
      : { entities_count: 0, relations_count: 0 }
    graphResult.entities_count += persisted.entities_count
    graphResult.relations_count += persisted.relations_count
    await execute(
      `UPDATE knowledge_sources SET enrichment_status = $1, enriched_revision = $2, atualizada_em = NOW()
       WHERE id = $3 AND revision = $2`,
      failedSources.has(sourceId) ? 'failed' : 'ready',
      graph.revision,
      sourceId,
    )
  }

  onProgress?.({
    fase: 'concluido',
    chunks_enriquecidos: totalEnriched,
    entities_count: graphResult.entities_count,
    relations_count: graphResult.relations_count,
  })

  console.log(`[enrichment] ══════════════════════════════════════════════`)
  console.log(`[enrichment] CONCLUIDO: ${totalEnriched} chunks enriquecidos, ${batchesFailed} batches falharam`)
  console.log(`[enrichment] Graph: ${graphResult.entities_count} entidades, ${graphResult.relations_count} relações`)
  console.log(`[enrichment] ══════════════════════════════════════════════`)

  return {
    chunks_enriquecidos: totalEnriched,
    entities_count: graphResult.entities_count,
    relations_count: graphResult.relations_count,
    batches_processados: batches.length,
    batches_failed: batchesFailed,
    provider: enrichmentModel.provider,
    modelo: enrichmentModel.modelo,
  }
}
