import fs from 'node:fs'
import path from 'node:path'
import { insertReturningId, execute, queryOne, transaction } from '../db/query'
import { chunkText } from './chunking'

type ManifestEntity = { name: string; type: string }
type ManifestRelation = { from: string; to: string; type: string; weight: number }
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

async function persistEntitiesAndRelations(document: ManifestDocument): Promise<{
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
    if (!existing) {
      await execute(
        `INSERT INTO knowledge_relations (entity_from_id, entity_to_id, tipo_relacao, peso)
         VALUES ($1, $2, $3, $4)`,
        fromId,
        toId,
        relation.type,
        relation.weight,
      )
      insertedRelations++
    }
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

  for (const document of documents) {
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM knowledge_sources WHERE metadata->>'bundled_document_id' = $1 LIMIT 1`,
      document.id,
    )

    if (!existing) {
      const chunks = chunkText(`Contexto: ${document.context}\n\n${document.content}`)
      await transaction(async () => {
        const sourceId = await insertReturningId(
          `INSERT INTO knowledge_sources (tipo, titulo, conteudo_original, metadata, importance)
           VALUES ('sistema', $1, $2, $3::jsonb, 'high')`,
          document.title,
          document.content,
          JSON.stringify({
            bundled_document_id: document.id,
            bundled_corpus_version: manifest.version,
            source_file: document.file,
            source_url: document.source_url,
            publisher: document.publisher,
            retrieved_at: manifest.retrieved_at,
            context_hint: document.context,
            derived_training_document: true,
          }),
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
      })
      imported++
    }

    const graph = await persistEntitiesAndRelations(document)
    entitiesCount += graph.entities
    relationsCount += graph.relations
  }

  const totals = await queryOne<{ sources: number; chunks: number; entities: number; relations: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM knowledge_sources WHERE metadata->>'bundled_corpus_version' = $1) AS sources,
       (SELECT COUNT(*)::int FROM knowledge_chunks kc JOIN knowledge_sources ks ON ks.id = kc.source_id
         WHERE ks.metadata->>'bundled_corpus_version' = $1) AS chunks,
       (SELECT COUNT(*)::int FROM knowledge_entities WHERE origem = 'sistema' AND valid_to IS NULL) AS entities,
       (SELECT COUNT(*)::int FROM knowledge_relations WHERE valid_to IS NULL) AS relations`,
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
