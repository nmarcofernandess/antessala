import { execute, insertReturningId, queryAll, queryOne, transaction } from '../db/query'
import { chunkText } from './chunking'
import {
  countWords,
  normalizeRichTextJson,
  richTextToMarkdown,
  richTextToPlainText,
  type RichTextJson,
} from './document-content'
import type { StructuredDocumentImport } from '../../shared/structured-document-import'

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

type RawDocument = Omit<KnowledgeDocument, 'content_json' | 'plain_text' | 'metadata'> & {
  content_json: unknown
  conteudo_original: string
  metadata: unknown
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, unknown>
  try { return JSON.parse(String(value)) as Record<string, unknown> } catch { return {} }
}

function mapDocument(row: RawDocument): KnowledgeDocument {
  return {
    id: row.id,
    titulo: row.titulo,
    content_json: normalizeRichTextJson(row.content_json),
    content_markdown: row.content_markdown,
    plain_text: row.conteudo_original,
    source_format: row.source_format,
    revision: Number(row.revision),
    page_count: row.page_count == null ? null : Number(row.page_count),
    word_count: Number(row.word_count),
    enrichment_status: row.enrichment_status,
    atualizada_em: row.atualizada_em,
    metadata: parseMetadata(row.metadata),
  }
}

export async function getKnowledgeDocument(id: number): Promise<KnowledgeDocument> {
  const row = await queryOne<RawDocument>(
    `SELECT id, titulo, content_json, content_markdown, conteudo_original,
            source_format, revision, page_count, word_count, enrichment_status,
            atualizada_em::text, metadata
       FROM knowledge_sources WHERE id = $1`,
    id,
  )
  if (!row?.content_json || !row.content_markdown) throw new Error('Documento não encontrado ou ainda não estruturado.')
  return mapDocument(row)
}

export async function listKnowledgeDocumentVersions(id: number): Promise<KnowledgeDocumentVersion[]> {
  const rows = await queryAll<KnowledgeDocumentVersion & { content_json: unknown }>(
    `SELECT revision, titulo, content_json, content_markdown, plain_text, reason, criada_em::text
       FROM knowledge_source_versions WHERE source_id = $1 ORDER BY revision DESC`,
    id,
  )
  return rows.map((row) => ({ ...row, revision: Number(row.revision), content_json: normalizeRichTextJson(row.content_json) }))
}

export async function reindexKnowledgeSource(sourceId: number, plainText: string): Promise<number> {
  await execute('DELETE FROM knowledge_chunks WHERE source_id = $1', sourceId)
  const chunks = chunkText(plainText)
  for (const content of chunks) {
    await execute(
      `INSERT INTO knowledge_chunks (source_id, conteudo, search_tsv, importance)
       VALUES ($1, $2, to_tsvector('portuguese', $2), 'high')`,
      sourceId,
      content,
    )
  }
  return chunks.length
}

export async function createKnowledgeDocument(input: {
  titulo: string
  document: StructuredDocumentImport
  contextHint?: string
  metadata?: Record<string, unknown>
  tipo?: 'manual' | 'sistema' | 'importacao_usuario'
  groupId?: number
}): Promise<{ source_id: number; index_count: number; document: KnowledgeDocument }> {
  const contentJson = normalizeRichTextJson(input.document.tiptapJson)
  const markdown = input.document.markdown.trim() || richTextToMarkdown(contentJson)
  const plainText = input.document.text.trim() || richTextToPlainText(contentJson)
  const titulo = input.titulo.trim() || input.document.suggestedTitle.trim()
  if (!titulo || !plainText) throw new Error('O documento importado precisa de título e conteúdo.')
  let sourceId = 0
  let indexCount = 0
  const metadata = {
    ...(input.metadata ?? {}),
    context_hint: input.contextHint?.trim() || undefined,
    file_name: input.document.metadata.fileName,
    mime_type: input.document.metadata.mimeType,
    byte_size: input.document.metadata.byteSize,
    warnings: input.document.warnings,
  }
  await transaction(async () => {
    sourceId = await insertReturningId(
      `INSERT INTO knowledge_sources (
         tipo, titulo, conteudo_original, content_json, content_markdown,
         source_format, revision, page_count, word_count, enrichment_status,
         metadata, importance, group_id
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, 1, $7, $8, 'pending', $9::jsonb, 'high', $10)
       RETURNING id`,
      input.tipo ?? 'importacao_usuario',
      titulo,
      plainText,
      JSON.stringify(contentJson),
      markdown,
      input.document.format,
      input.document.metadata.pageCount || null,
      input.document.wordCount || countWords(plainText),
      JSON.stringify(metadata),
      input.groupId ?? null,
    )
    if (!sourceId) throw new Error('Não foi possível criar o documento.')
    await execute(
      `INSERT INTO knowledge_source_versions (
         source_id, revision, titulo, content_json, content_markdown, plain_text, reason
       ) VALUES ($1, 1, $2, $3::jsonb, $4, $5, 'import')`,
      sourceId,
      titulo,
      JSON.stringify(contentJson),
      markdown,
      plainText,
    )
    indexCount = await reindexKnowledgeSource(sourceId, input.contextHint?.trim()
      ? `Contexto: ${input.contextHint.trim()}\n\n${plainText}`
      : plainText)
  })
  return {
    source_id: sourceId,
    index_count: indexCount,
    document: {
      id: sourceId,
      titulo,
      content_json: contentJson,
      content_markdown: markdown,
      plain_text: plainText,
      source_format: input.document.format,
      revision: 1,
      page_count: input.document.metadata.pageCount || null,
      word_count: input.document.wordCount || countWords(plainText),
      enrichment_status: 'pending',
      atualizada_em: new Date().toISOString(),
      metadata,
    },
  }
}

export async function saveKnowledgeDocument(input: {
  id: number
  expected_revision: number
  titulo: string
  content_json: unknown
  reason?: string
}): Promise<KnowledgeDocument> {
  const contentJson = normalizeRichTextJson(input.content_json)
  const markdown = richTextToMarkdown(contentJson)
  const plainText = richTextToPlainText(contentJson)
  const titulo = input.titulo.trim()
  if (!titulo) throw new Error('O título do documento é obrigatório.')
  if (!plainText) throw new Error('O documento não pode ficar vazio.')

  await transaction(async () => {
    const current = await queryOne<{
      revision: number
      content_json: unknown
      enrichment_status: KnowledgeDocument['enrichment_status']
      enriched_revision: number | null
    }>(
      `SELECT revision, content_json, enrichment_status, enriched_revision
         FROM knowledge_sources WHERE id = $1 FOR UPDATE`,
      input.id,
    )
    if (!current) throw new Error('Documento não encontrado.')
    const currentRevision = Number(current.revision)
    if (currentRevision !== input.expected_revision) {
      throw new Error(`Conflito de edição: o documento já está na revisão ${currentRevision}.`)
    }
    const revision = currentRevision + 1
    const contentChanged = JSON.stringify(normalizeRichTextJson(current.content_json)) !== JSON.stringify(contentJson)
    await execute(
      `UPDATE knowledge_sources SET titulo = $1, conteudo_original = $2,
         content_json = $3::jsonb, content_markdown = $4, revision = $5,
         word_count = $6, enrichment_status = 'indexing', atualizada_em = NOW()
       WHERE id = $7`,
      titulo,
      plainText,
      JSON.stringify(contentJson),
      markdown,
      revision,
      countWords(plainText),
      input.id,
    )
    await execute(
      `INSERT INTO knowledge_source_versions (
         source_id, revision, titulo, content_json, content_markdown, plain_text, reason
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      input.id,
      revision,
      titulo,
      JSON.stringify(contentJson),
      markdown,
      plainText,
      input.reason ?? 'autosave',
    )
    if (contentChanged) {
      await execute(
        `UPDATE knowledge_relation_evidence SET invalidated_at = NOW()
         WHERE source_id = $1 AND source_revision < $2 AND invalidated_at IS NULL`,
        input.id,
        revision,
      )
      await execute(
        `DELETE FROM knowledge_relations kr
          WHERE EXISTS (
            SELECT 1 FROM knowledge_relation_evidence ev
             WHERE ev.relation_id = kr.id AND ev.source_id = $1
          )
            AND NOT EXISTS (
              SELECT 1 FROM knowledge_relation_evidence active
               WHERE active.relation_id = kr.id AND active.invalidated_at IS NULL
            )`,
        input.id,
      )
      await reindexKnowledgeSource(input.id, plainText)
      await execute(
        `UPDATE knowledge_sources SET enrichment_status = 'pending', enriched_revision = NULL
         WHERE id = $1`,
        input.id,
      )
    } else {
      const canCarryEnrichment = current.enrichment_status === 'ready'
        && Number(current.enriched_revision) === currentRevision
      if (canCarryEnrichment) {
        await execute(
          `INSERT INTO knowledge_relation_evidence (
             relation_id, source_id, source_revision, section_ref, excerpt
           ) SELECT relation_id, source_id, $2, section_ref, excerpt
               FROM knowledge_relation_evidence
              WHERE source_id = $1 AND source_revision = $3 AND invalidated_at IS NULL
           ON CONFLICT (relation_id, source_id, source_revision, section_ref) DO NOTHING`,
          input.id,
          revision,
          currentRevision,
        )
        await execute(
          `UPDATE knowledge_relation_evidence SET invalidated_at = NOW()
           WHERE source_id = $1 AND source_revision = $2 AND invalidated_at IS NULL`,
          input.id,
          currentRevision,
        )
        await execute(
          `UPDATE knowledge_sources SET enrichment_status = 'ready', enriched_revision = $2
           WHERE id = $1`,
          input.id,
          revision,
        )
      } else {
        await execute(
          `UPDATE knowledge_sources
              SET enrichment_status = $2, enriched_revision = NULL
            WHERE id = $1`,
          input.id,
          current.enrichment_status === 'failed' ? 'failed' : 'pending',
        )
      }
    }
  })
  return getKnowledgeDocument(input.id)
}

export async function restoreKnowledgeDocumentVersion(input: {
  id: number
  revision: number
  expected_revision: number
}): Promise<KnowledgeDocument> {
  const version = await queryOne<KnowledgeDocumentVersion & { content_json: unknown }>(
    `SELECT revision, titulo, content_json, content_markdown, plain_text, reason, criada_em::text
       FROM knowledge_source_versions WHERE source_id = $1 AND revision = $2`,
    input.id,
    input.revision,
  )
  if (!version) throw new Error('Versão não encontrada.')
  return saveKnowledgeDocument({
    id: input.id,
    expected_revision: input.expected_revision,
    titulo: version.titulo,
    content_json: version.content_json,
    reason: `restore:${input.revision}`,
  })
}
