import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, insertReturningId, queryAll, queryOne } from '../../../src/main/db/query'
import { enrichAllChunksWithModel } from '../../../src/main/knowledge/enrichment'
import type { EnrichmentModel } from '../../../src/main/knowledge/enrichment'

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
})
