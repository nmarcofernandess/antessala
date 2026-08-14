import fs from 'node:fs'
import path from 'node:path'
import { insertReturningId, execute, queryOne, transaction } from '../db/query'
import { chunkText } from './chunking'
import { markdownToRichText } from './document-content'

type ManifestEntity = { name: string; type: string }
type ManifestEvidence = {
  source_id: string
  source_revision: string
  source_pages: string
  section: string
}
type ManifestRelation = { from: string; to: string; type: string; weight: number; evidence: ManifestEvidence }
type ManifestDocument = {
  id: string
  file: string
  title: string
  context: string
  source_url: string
  publisher: string
  summary: string
  tags: string[]
  entities: ManifestEntity[]
  relations: ManifestRelation[]
  source_revision: string
  source_pages: string
  content_mode: string
  license_note: string
  word_count: number
  content_sha256: string
}
type CorpusManifest = {
  version: string
  retrieved_at: string
  documents: ManifestDocument[]
}

export type BundledCorpusSeedResult = {
  imported: number
  sources_count: number
  chunks_count: number
  entities_count: number
  relations_count: number
  corpus_version: string
}

function resolveCorpusDir(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const packagedDir = resourcesPath ? path.join(resourcesPath, 'knowledge-corpus') : null
  if (packagedDir && fs.existsSync(path.join(packagedDir, 'manifest.json'))) return packagedDir
  return path.join(process.cwd(), 'src/data/knowledge-corpus')
}

export function loadBundledKnowledgeCorpus(): {
  manifest: CorpusManifest
  documents: Array<ManifestDocument & { content: string }>
} {
  const corpusDir = resolveCorpusDir()
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusDir, 'manifest.json'), 'utf8')) as CorpusManifest
  if (!manifest.version || manifest.documents.length !== 10) {
    throw new Error('O corpus inicial de conhecimento deve declarar versão e exatamente 10 documentos.')
  }

  const ids = new Set<string>()
  const documents = manifest.documents.map((document) => {
    if (ids.has(document.id)) throw new Error(`ID duplicado no corpus inicial: ${document.id}`)
    ids.add(document.id)
    const content = fs.readFileSync(path.join(corpusDir, document.file), 'utf8').trim()
    if (!content || document.entities.length === 0 || document.relations.length === 0) {
      throw new Error(`Documento incompleto no corpus inicial: ${document.file}`)
    }
    const entityNames = new Set(document.entities.map((entity) => entity.name))
    for (const relation of document.relations) {
      if (!entityNames.has(relation.from) || !entityNames.has(relation.to)) {
        throw new Error(`Relação órfã em ${document.file}: ${relation.from} -> ${relation.to}`)
      }
    }
    return { ...document, content }
  })
  return { manifest, documents }
}

function pageCountFromEvidence(value: string): number | null {
  const numbers = value.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? []
  return numbers.length ? Math.max(...numbers) : null
}

function excerptForSection(content: string, section: string): string {
  const marker = `## ${section}`
  const start = content.indexOf(marker)
  if (start < 0) return content.slice(0, 500)
  const next = content.indexOf('\n## ', start + marker.length)
  return content.slice(start, next < 0 ? start + 700 : Math.min(next, start + 700)).trim()
}

async function persistEntitiesAndRelations(
  document: ManifestDocument,
  sourceId: number,
  content: string,
): Promise<{
  entities: number
  relations: number
}> {
  const entityIds = new Map<string, number>()
  let insertedEntities = 0
  let insertedRelations = 0

  for (const entity of document.entities) {
    let id = await insertReturningId(
      `INSERT INTO knowledge_entities (nome, tipo, origem)
       VALUES ($1, $2, 'sistema')
       ON CONFLICT (nome, tipo) DO NOTHING
       RETURNING id`,
      entity.name,
      entity.type,
    )
    if (id) insertedEntities++
    if (!id) {
      id = (await queryOne<{ id: number }>(
        'SELECT id FROM knowledge_entities WHERE nome = $1 AND tipo = $2',
        entity.name,
        entity.type,
      ))?.id ?? 0
    }
    if (!id) throw new Error(`Não foi possível persistir a entidade ${entity.name}.`)
    entityIds.set(entity.name, id)
  }

  for (const relation of document.relations) {
    const fromId = entityIds.get(relation.from)
    const toId = entityIds.get(relation.to)
    if (!fromId || !toId) throw new Error(`Relação sem entidade persistida: ${relation.from} -> ${relation.to}`)
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM knowledge_relations
       WHERE entity_from_id = $1 AND entity_to_id = $2 AND tipo_relacao = $3 AND valid_to IS NULL
       LIMIT 1`,
      fromId,
      toId,
      relation.type,
    )
    let relationId = existing?.id ?? 0
    if (!relationId) {
      relationId = await insertReturningId(
        `INSERT INTO knowledge_relations (entity_from_id, entity_to_id, tipo_relacao, peso)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        fromId,
        toId,
        relation.type,
        relation.weight,
      )
      insertedRelations++
    }
    await execute(
      `INSERT INTO knowledge_relation_evidence (
         relation_id, source_id, source_revision, section_ref, excerpt
       ) VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (relation_id, source_id, source_revision, section_ref)
       DO UPDATE SET excerpt = EXCLUDED.excerpt, invalidated_at = NULL`,
      relationId,
      sourceId,
      `${relation.evidence.section} · páginas ${relation.evidence.source_pages}`,
      excerptForSection(content, relation.evidence.section),
    )
  }
  return { entities: insertedEntities, relations: insertedRelations }
}

/**
 * Instala o corpus que acompanha o Antessala no primeiro boot. O processo é
 * local, idempotente e determinístico: não chama Gemini, embeddings ou rede.
 */
export async function seedBundledKnowledgeCorpus(): Promise<BundledCorpusSeedResult> {
  const { manifest, documents } = loadBundledKnowledgeCorpus()
  let imported = 0
  let chunksCount = 0
  let entitiesCount = 0
  let relationsCount = 0

  // Remove somente a fixture antiga da própria aplicação; nunca toca em fontes importadas pelo usuário.
  await execute(
    `DELETE FROM knowledge_sources
     WHERE metadata->>'synthetic_fixture' = 'true'
       AND metadata->>'bundled_corpus_version' IS NULL`,
  )

  const staleSources = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM knowledge_sources
      WHERE metadata->>'bundled_document_id' IS NOT NULL
        AND COALESCE(metadata->>'content_sha256', '') NOT IN (
          SELECT value FROM jsonb_array_elements_text($1::jsonb)
        )`,
    JSON.stringify(documents.map((document) => document.content_sha256)),
  )
  if ((staleSources?.total ?? 0) > 0) {
    await execute(
      `DELETE FROM knowledge_sources
        WHERE metadata->>'bundled_document_id' IS NOT NULL
          AND COALESCE(metadata->>'content_sha256', '') NOT IN (
            SELECT value FROM jsonb_array_elements_text($1::jsonb)
          )`,
      JSON.stringify(documents.map((document) => document.content_sha256)),
    )
    await execute(
      `DELETE FROM knowledge_relations kr
        WHERE NOT EXISTS (SELECT 1 FROM knowledge_relation_evidence ev WHERE ev.relation_id = kr.id)
          AND EXISTS (SELECT 1 FROM knowledge_entities ke WHERE ke.id = kr.entity_from_id AND ke.origem = 'sistema')
          AND EXISTS (SELECT 1 FROM knowledge_entities ke WHERE ke.id = kr.entity_to_id AND ke.origem = 'sistema')`,
    )
  }

  for (const document of documents) {
    let existing = await queryOne<{ id: number }>(
      `SELECT id FROM knowledge_sources WHERE metadata->>'bundled_document_id' = $1 LIMIT 1`,
      document.id,
    )

    if (!existing) {
      const chunks = chunkText(`Contexto: ${document.context}\n\n${document.content}`)
      await transaction(async () => {
        const sourceId = await insertReturningId(
          `INSERT INTO knowledge_sources (
             tipo, titulo, conteudo_original, content_json, content_markdown,
             source_format, revision, page_count, word_count, enrichment_status,
             enriched_revision, metadata, importance
           ) VALUES ('sistema', $1, $2, $3::jsonb, $2, 'markdown', 1, $4, $5,
             'ready', 1, $6::jsonb, 'high')`,
          document.title,
          document.content,
          JSON.stringify(markdownToRichText(document.content)),
          pageCountFromEvidence(document.source_pages),
          document.word_count,
          JSON.stringify({
            bundled_document_id: document.id,
            bundled_corpus_version: manifest.version,
            source_file: document.file,
            source_url: document.source_url,
            publisher: document.publisher,
            retrieved_at: manifest.retrieved_at,
            context_hint: document.context,
            derived_training_document: true,
            source_revision: document.source_revision,
            source_pages: document.source_pages,
            content_mode: document.content_mode,
            license_note: document.license_note,
            content_sha256: document.content_sha256,
          }),
        )
        await execute(
          `INSERT INTO knowledge_source_versions (
             source_id, revision, titulo, content_json, content_markdown, plain_text, reason
           ) VALUES ($1, 1, $2, $3::jsonb, $4, $4, 'bundled-corpus')`,
          sourceId,
          document.title,
          JSON.stringify(markdownToRichText(document.content)),
          document.content,
        )
        for (const content of chunks) {
          await execute(
            `INSERT INTO knowledge_chunks (
               source_id, conteudo, search_tsv, importance, enriched_at, enrichment_json
             ) VALUES ($1, $2, to_tsvector('portuguese', $3), 'high', NOW(), $4)`,
            sourceId,
            content,
            content,
            JSON.stringify({
              resumo: document.summary,
              tags: document.tags,
              entidades: document.entities.map(({ name, type }) => ({ nome: name, tipo: type })),
              relacoes: document.relations.map((relation) => ({
                from: relation.from,
                to: relation.to,
                tipo_relacao: relation.type,
                peso: relation.weight,
              })),
              provider: 'bundled-corpus',
              modelo: manifest.version,
            }),
          )
        }
        chunksCount += chunks.length
        existing = { id: sourceId }
      })
      imported++
    }

    if (!existing?.id) throw new Error(`Fonte do corpus não persistida: ${document.id}`)
    const graph = await persistEntitiesAndRelations(document, existing.id, document.content)
    entitiesCount += graph.entities
    relationsCount += graph.relations
  }

  const totals = await queryOne<{ sources: number; chunks: number; entities: number; relations: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM knowledge_sources WHERE metadata->>'bundled_corpus_version' = $1) AS sources,
       (SELECT COUNT(*)::int FROM knowledge_chunks kc JOIN knowledge_sources ks ON ks.id = kc.source_id
         WHERE ks.metadata->>'bundled_corpus_version' = $1) AS chunks,
       (SELECT COUNT(*)::int FROM knowledge_entities WHERE origem = 'sistema' AND valid_to IS NULL) AS entities,
       (SELECT COUNT(DISTINCT kr.id)::int FROM knowledge_relations kr
          JOIN knowledge_relation_evidence ev ON ev.relation_id = kr.id AND ev.invalidated_at IS NULL
         WHERE kr.valid_to IS NULL) AS relations`,
    manifest.version,
  )

  if (totals?.sources !== documents.length) {
    throw new Error(`Corpus inicial incompleto: esperado ${documents.length}, encontrado ${totals?.sources ?? 0}.`)
  }

  return {
    imported,
    sources_count: totals.sources,
    chunks_count: totals.chunks,
    entities_count: totals.entities,
    relations_count: totals.relations,
    corpus_version: manifest.version,
  }
}
