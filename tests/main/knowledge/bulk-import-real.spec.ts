import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { queryAll, queryOne } from '../../../src/main/db/query'
import { runBulkRagImport } from '../../../src/main/knowledge/bulk-import'
import { searchKnowledge } from '../../../src/main/knowledge/search'

vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generatePassageEmbedding: vi.fn(async () => null),
  generatePassageEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
  generateQueryEmbedding: vi.fn(async () => null),
}))

describe('bulk RAG import with real persistence', () => {
  let dbDir: string
  let docsDir: string

  beforeEach(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'flowkit-rag-db-'))
    docsDir = await mkdtemp(path.join(os.tmpdir(), 'flowkit-rag-docs-'))
    process.env.FLOWKIT_DB_PATH = dbDir
    await initDb()
    await createTables()
  })

  afterEach(async () => {
    await closeDb()
    delete process.env.FLOWKIT_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
    await rm(docsDir, { recursive: true, force: true })
  })

  it('imports files, records job/file rows, and makes imported text searchable', async () => {
    const proofToken = `bulkproofpadaria${Date.now()}`
    await writeFile(
      path.join(docsDir, 'prova.md'),
      [
        '# Prova RAG',
        '',
        `Este documento confirma importacao real do RAG com token ${proofToken}.`,
        'A massa fermenta devagar para criar conteudo acima do limite minimo de chunk.',
      ].join('\n'),
      'utf-8',
    )

    const summary = await runBulkRagImport({
      path: docsDir,
      group_name: 'Grupo Prova Real',
      auto_enrich: false,
    })

    expect(summary.imported_files).toBe(1)
    expect(summary.failed_files).toBe(0)
    expect(summary.chunks_count).toBeGreaterThan(0)

    const job = await queryOne<{
      status: string
      processed_files: number
      failed_files: number
      chunks_created: number
      error_message: string | null
    }>('SELECT status, processed_files, failed_files, chunks_created, error_message FROM knowledge_import_jobs WHERE id = $1', summary.import_job_id)
    expect(job).toMatchObject({
      status: 'done',
      processed_files: 1,
      failed_files: 0,
      chunks_created: summary.chunks_count,
      error_message: null,
    })

    const files = await queryAll<{ status: string; source_id: number | null; relative_path: string }>(
      'SELECT status, source_id, relative_path FROM knowledge_import_files WHERE job_id = $1 ORDER BY id',
      summary.import_job_id,
    )
    expect(files).toEqual([
      { status: 'done', source_id: expect.any(Number), relative_path: 'prova.md' },
    ])

    const chunks = await queryAll<{ conteudo: string }>(
      'SELECT conteudo FROM knowledge_chunks WHERE conteudo ILIKE $1',
      `%${proofToken}%`,
    )
    expect(chunks).toHaveLength(1)

    const search = await searchKnowledge(proofToken, { limite: 5 })
    expect(search.chunks.some((chunk) => chunk.conteudo.includes(proofToken))).toBe(true)
  })
})
