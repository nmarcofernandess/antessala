import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, insertReturningId, queryAll, queryOne } from '../../../src/main/db/query'
import { enrichAllChunksWithModel } from '../../../src/main/knowledge/enrichment'
import type { EnrichmentModel } from '../../../src/main/knowledge/enrichment'
import { seedBundledKnowledgeCorpus } from '../../../src/main/knowledge/bundled-corpus'
import { insertChunk } from '../../../src/main/knowledge/ingest'
import { searchKnowledge } from '../../../src/main/knowledge/search'

vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generatePassageEmbedding: vi.fn(async () => null),
  generatePassageEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
  generateQueryEmbedding: vi.fn(async () => null),
}))

describe('knowledge enrichment with real persistence', () => {
  let dbDir: string

  beforeEach(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-enrichment-db-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    await initDb()
    await createTables()
  })

  afterEach(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  it('enriches only the requested bulk group and persists graph relations', async () => {
    const targetGroupId = await insertReturningId(
      "INSERT INTO knowledge_groups (nome, origem, metadata) VALUES ('Grupo alvo', 'usuario', '{}')",
    )
    const otherGroupId = await insertReturningId(
      "INSERT INTO knowledge_groups (nome, origem, metadata) VALUES ('Grupo fora', 'usuario', '{}')",
    )
    const targetSourceId = await insertReturningId(
      `INSERT INTO knowledge_sources (tipo, titulo, conteudo_original, group_id, metadata, importance)
       VALUES ('importacao_usuario', 'Doc alvo', 'conteudo alvo', $1, $2::jsonb, 'high')`,
      targetGroupId,
      JSON.stringify({ bulk_group_id: String(targetGroupId) }),
    )
    const otherSourceId = await insertReturningId(
      `INSERT INTO knowledge_sources (tipo, titulo, conteudo_original, group_id, metadata, importance)
       VALUES ('importacao_usuario', 'Doc fora', 'conteudo fora', $1, $2::jsonb, 'high')`,
      otherGroupId,
      JSON.stringify({ bulk_group_id: String(otherGroupId) }),
    )

    await execute(
      `INSERT INTO knowledge_chunks (source_id, conteudo, search_tsv, importance)
       VALUES ($1, $2, to_tsvector('portuguese', $2), 'high')`,
      targetSourceId,
      'AlphaFlow usa BetaKernel para provar enrichment real e persistencia de relacao no grafo de conhecimento.',
    )
    await execute(
      `INSERT INTO knowledge_chunks (source_id, conteudo, search_tsv, importance)
       VALUES ($1, $2, to_tsvector('portuguese', $2), 'high')`,
      otherSourceId,
      'Outro grupo nao deve ser enriquecido durante uma execucao filtrada por bulkGroupId.',
    )

    const prompts: string[] = []
    const model: EnrichmentModel = {
      provider: 'openrouter',
      modelo: 'fake-enrichment',
      async generate(prompt: string) {
        prompts.push(prompt)
        return {
          chunks: [{
            index: 0,
            resumo: 'AlphaFlow usa BetaKernel.',
            tags: ['AlphaFlow', 'BetaKernel', 'grafo', 'enrichment', 'prova'],
            entidades: [
              { nome: 'AlphaFlow', tipo: 'projeto' },
              { nome: 'BetaKernel', tipo: 'tecnologia' },
            ],
            relacoes: [
              { from: 'AlphaFlow', to: 'BetaKernel', tipo_relacao: 'usa', peso: 1 },
            ],
          }],
        }
      },
    }

    const result = await enrichAllChunksWithModel(model, { bulkGroupId: targetGroupId })

    expect(result).toMatchObject({
      chunks_enriquecidos: 1,
      entities_count: 2,
      relations_count: 1,
      batches_failed: 0,
    })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('AlphaFlow usa BetaKernel')
    expect(prompts[0]).not.toContain('Outro grupo nao deve ser enriquecido')

    const targetChunk = await queryOne<{ enriched_at: string | null; enrichment_json: string | null }>(
      'SELECT enriched_at::text, enrichment_json FROM knowledge_chunks WHERE source_id = $1',
      targetSourceId,
    )
    expect(targetChunk?.enriched_at).toBeTruthy()
    expect(targetChunk?.enrichment_json).toContain('AlphaFlow usa BetaKernel')

    const otherChunk = await queryOne<{ enriched_at: string | null; enrichment_json: string | null }>(
      'SELECT enriched_at::text, enrichment_json FROM knowledge_chunks WHERE source_id = $1',
      otherSourceId,
    )
    expect(otherChunk?.enriched_at).toBeNull()
    expect(otherChunk?.enrichment_json).toBeNull()

    const relations = await queryAll<{ from_nome: string; to_nome: string; tipo_relacao: string }>(`
      SELECT ef.nome AS from_nome, et.nome AS to_nome, kr.tipo_relacao
      FROM knowledge_relations kr
      JOIN knowledge_entities ef ON ef.id = kr.entity_from_id
      JOIN knowledge_entities et ON et.id = kr.entity_to_id
    `)
    expect(relations).toEqual([
      { from_nome: 'AlphaFlow', to_nome: 'BetaKernel', tipo_relacao: 'usa' },
    ])
  })

  it('enriches only the newly imported source when sourceId is provided', async () => {
    const firstSource = await insertReturningId(
      `INSERT INTO knowledge_sources (tipo, titulo, conteudo_original, metadata, importance)
       VALUES ('manual', 'Primeira fonte', 'conteudo', '{}'::jsonb, 'high')`,
    )
    const targetSource = await insertReturningId(
      `INSERT INTO knowledge_sources (tipo, titulo, conteudo_original, metadata, importance)
       VALUES ('manual', 'Fonte alvo', 'conteudo', '{}'::jsonb, 'high')`,
    )
    await insertChunk(firstSource, 'Esta fonte anterior nao deve ser enriquecida por uma importacao posterior com filtro de origem.', null)
    await insertChunk(targetSource, 'Checklist cirurgico melhora a comunicacao da equipe durante o cuidado perioperatorio.', null)

    const model: EnrichmentModel = {
      provider: 'gemini',
      modelo: 'fixture-source-filter',
      generate: vi.fn().mockResolvedValue({
        chunks: [{
          index: 0,
          resumo: 'Checklist melhora a comunicação perioperatória.',
          tags: ['checklist', 'segurança', 'perioperatório'],
          entidades: [
            { nome: 'Checklist cirúrgico', tipo: 'documento' },
            { nome: 'Equipe perioperatória', tipo: 'funcao' },
          ],
          relacoes: [{ from: 'Checklist cirúrgico', to: 'Equipe perioperatória', tipo_relacao: 'apoia', peso: 1 }],
        }],
      }),
    }

    const result = await enrichAllChunksWithModel(model, { sourceId: targetSource })
    expect(result.chunks_enriquecidos).toBe(1)
    const first = await queryOne<{ enriched_at: string | null }>(
      'SELECT enriched_at::text FROM knowledge_chunks WHERE source_id = $1', firstSource,
    )
    const target = await queryOne<{ enriched_at: string | null }>(
      'SELECT enriched_at::text FROM knowledge_chunks WHERE source_id = $1', targetSource,
    )
    expect(first?.enriched_at).toBeNull()
    expect(target?.enriched_at).toBeTruthy()

    await enrichAllChunksWithModel(model, { sourceId: firstSource })
    const canonical = await queryOne<{ relations: number; evidence: number }>(`
      SELECT
        (SELECT COUNT(*)::int FROM knowledge_relations) AS relations,
        (SELECT COUNT(*)::int FROM knowledge_relation_evidence) AS evidence
    `)
    expect(canonical).toEqual({ relations: 1, evidence: 2 })
  })

  it('installs the bundled corpus idempotently with searchable chunks and graph relations', async () => {
    const first = await seedBundledKnowledgeCorpus()
    const second = await seedBundledKnowledgeCorpus()

    expect(first).toMatchObject({ imported: 10, sources_count: 10, corpus_version: 'perioperative-corpus-v2' })
    expect(second).toMatchObject({ imported: 0, sources_count: 10, corpus_version: 'perioperative-corpus-v2' })
    const counts = await queryOne<{
      sources: number
      structured: number
      versions: number
      enriched: number
      entities: number
      relations: number
      evidence: number
      orphan_evidence: number
      relations_without_evidence: number
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM knowledge_sources WHERE metadata->>'bundled_corpus_version' = 'perioperative-corpus-v2') AS sources,
        (SELECT COUNT(*)::int FROM knowledge_sources
          WHERE metadata->>'bundled_corpus_version' = 'perioperative-corpus-v2'
            AND content_json IS NOT NULL AND content_markdown IS NOT NULL
            AND word_count >= 800 AND page_count > 1) AS structured,
        (SELECT COUNT(*)::int FROM knowledge_source_versions ksv
          JOIN knowledge_sources ks ON ks.id = ksv.source_id
          WHERE ks.metadata->>'bundled_corpus_version' = 'perioperative-corpus-v2') AS versions,
        (SELECT COUNT(*)::int FROM knowledge_chunks WHERE enriched_at IS NOT NULL) AS enriched,
        (SELECT COUNT(*)::int FROM knowledge_entities WHERE origem = 'sistema') AS entities,
        (SELECT COUNT(*)::int FROM knowledge_relations) AS relations,
        (SELECT COUNT(*)::int FROM knowledge_relation_evidence) AS evidence,
        (SELECT COUNT(*)::int FROM knowledge_relation_evidence ev
          LEFT JOIN knowledge_sources ks ON ks.id = ev.source_id AND ks.revision = ev.source_revision
          WHERE ks.id IS NULL) AS orphan_evidence,
        (SELECT COUNT(*)::int FROM knowledge_relations kr
          WHERE NOT EXISTS (SELECT 1 FROM knowledge_relation_evidence ev WHERE ev.relation_id = kr.id)) AS relations_without_evidence
    `)
    expect(counts?.sources).toBe(10)
    expect(counts?.structured).toBe(10)
    expect(counts?.versions).toBe(10)
    expect(counts?.enriched).toBeGreaterThanOrEqual(10)
    expect(counts?.entities).toBeGreaterThanOrEqual(30)
    expect(counts?.relations).toBeGreaterThanOrEqual(40)
    expect(counts?.evidence).toBeGreaterThanOrEqual(50)
    expect(counts?.orphan_evidence).toBe(0)
    expect(counts?.relations_without_evidence).toBe(0)

    for (const question of [
      'o que verificar antes da indução anestésica?',
      'luvas substituem higiene das mãos?',
      'quais identificadores usar antes de administrar medicamentos?',
      'quem decide realizar o ato anestésico?',
    ]) {
      const result = await searchKnowledge(question, { limite: 3 })
      expect(result.chunks.length, question).toBeGreaterThan(0)
      expect(result.context_for_llm, question).not.toBe('')
    }
  })
})
