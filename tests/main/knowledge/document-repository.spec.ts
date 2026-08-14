import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, queryOne } from '../../../src/main/db/query'
import {
  getKnowledgeDocument,
  listKnowledgeDocumentVersions,
  restoreKnowledgeDocumentVersion,
  saveKnowledgeDocument,
} from '../../../src/main/knowledge/document-repository'

const INITIAL_JSON = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Documento inicial' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo pesquisável inicial.' }] },
  ],
}

describe('document repository', () => {
  let dbDir: string
  let sourceId: number

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-document-repository-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    await initDb()
    await createTables()
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO knowledge_sources (
         tipo, titulo, conteudo_original, content_json, content_markdown,
         source_format, revision, word_count, enrichment_status
       ) VALUES ('manual', 'Documento inicial', 'Conteúdo pesquisável inicial.', $1::jsonb,
         '# Documento inicial\n\nConteúdo pesquisável inicial.', 'markdown', 1, 3, 'ready')
       RETURNING id`,
      JSON.stringify(INITIAL_JSON),
    )
    sourceId = inserted!.id
    await execute(
      `INSERT INTO knowledge_source_versions (
         source_id, revision, titulo, content_json, content_markdown, plain_text, reason
       ) VALUES ($1, 1, 'Documento inicial', $2::jsonb,
         '# Documento inicial\n\nConteúdo pesquisável inicial.', 'Conteúdo pesquisável inicial.', 'import')`,
      sourceId,
      JSON.stringify(INITIAL_JSON),
    )
    const from = await queryOne<{ id: number }>(
      `INSERT INTO knowledge_entities (nome, tipo, origem) VALUES ('Checklist', 'protocolo', 'usuario') RETURNING id`,
    )
    const to = await queryOne<{ id: number }>(
      `INSERT INTO knowledge_entities (nome, tipo, origem) VALUES ('Verificação', 'ação', 'usuario') RETURNING id`,
    )
    const relation = await queryOne<{ id: number }>(
      `INSERT INTO knowledge_relations (entity_from_id, entity_to_id, tipo_relacao, peso)
       VALUES ($1, $2, 'exige', 1) RETURNING id`,
      from!.id,
      to!.id,
    )
    await execute(
      `INSERT INTO knowledge_relation_evidence (
         relation_id, source_id, source_revision, section_ref, excerpt
       ) VALUES ($1, $2, 1, 'Documento inicial', 'Evidência da revisão inicial.')`,
      relation!.id,
      sourceId,
    )
  })

  afterAll(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  it('salva uma nova revisão e reconstrói o índice interno sem expor chunks no contrato', async () => {
    const updatedJson = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título editado' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Texto novo que precisa ser recuperável.' }] },
      ],
    }

    const saved = await saveKnowledgeDocument({
      id: sourceId,
      expected_revision: 1,
      titulo: 'Título editado',
      content_json: updatedJson,
      reason: 'autosave',
    })

    expect(saved).toMatchObject({ id: sourceId, revision: 2, titulo: 'Título editado' })
    expect(saved).not.toHaveProperty('chunks')
    const persisted = await getKnowledgeDocument(sourceId)
    expect(persisted.revision).toBe(2)
    expect(persisted.content_markdown).toContain('# Título editado')
    const index = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM knowledge_chunks WHERE source_id = $1',
      sourceId,
    )
    expect(index?.count).toBeGreaterThan(0)
    const orphanedRelations = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM knowledge_relations kr
        WHERE NOT EXISTS (
          SELECT 1 FROM knowledge_relation_evidence ev
           WHERE ev.relation_id = kr.id AND ev.invalidated_at IS NULL
        )`,
    )
    expect(orphanedRelations?.count).toBe(0)
  })

  it('recusa autosave stale com o número da revisão atual', async () => {
    await expect(saveKnowledgeDocument({
      id: sourceId,
      expected_revision: 1,
      titulo: 'Sobrescrita stale',
      content_json: INITIAL_JSON,
      reason: 'autosave',
    })).rejects.toThrow(/conflito.*revisão 2/i)
  })

  it('não promove para ready uma fonte pending renomeada sem enriquecimento', async () => {
    const pending = await queryOne<{ id: number }>(
      `INSERT INTO knowledge_sources (
         tipo, titulo, conteudo_original, content_json, content_markdown,
         source_format, revision, word_count, enrichment_status
       ) VALUES ('manual', 'Pendente', 'Conteúdo pendente.', $1::jsonb,
         'Conteúdo pendente.', 'markdown', 1, 2, 'pending') RETURNING id`,
      JSON.stringify(INITIAL_JSON),
    )

    const renamed = await saveKnowledgeDocument({
      id: pending!.id,
      expected_revision: 1,
      titulo: 'Pendente renomeado',
      content_json: INITIAL_JSON,
      reason: 'autosave',
    })

    expect(renamed).toMatchObject({
      revision: 2,
      titulo: 'Pendente renomeado',
      enrichment_status: 'pending',
    })
    const state = await queryOne<{ enriched_revision: number | null }>(
      'SELECT enriched_revision FROM knowledge_sources WHERE id = $1',
      pending!.id,
    )
    expect(state?.enriched_revision).toBeNull()
  })

  it('mantém versões recuperáveis e restaura como uma nova revisão', async () => {
    const before = await listKnowledgeDocumentVersions(sourceId)
    expect(before.map((version) => version.revision)).toEqual([2, 1])

    const restored = await restoreKnowledgeDocumentVersion({
      id: sourceId,
      revision: 1,
      expected_revision: 2,
    })

    expect(restored.revision).toBe(3)
    expect(restored.titulo).toBe('Documento inicial')
    expect((await listKnowledgeDocumentVersions(sourceId))[0]).toMatchObject({
      revision: 3,
      reason: 'restore:1',
    })
  })
})
