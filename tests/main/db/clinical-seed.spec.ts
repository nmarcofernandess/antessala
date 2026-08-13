import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { queryOne, execute } from '../../../src/main/db/query'
import { seedData } from '../../../src/main/db/seed'

describe('primeiro boot clínico offline', () => {
  let dbDir: string
  const fetchSpy = vi.fn(async () => {
    throw new Error('rede bloqueada pelo teste de primeiro boot')
  })

  beforeAll(async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as typeof fetch
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-clinical-seed-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    try {
      await initDb()
      await createTables()
      await seedData()
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 60_000)

  afterAll(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  it('carrega exclusivamente os assets clínicos versionados', async () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    const counts = await queryOne<{
      cid: number
      medicamentos: number
      classes: number
      grupos: number
      met: number
      comorbidades: number
      system_knowledge_rows: number
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM catalogo_cid10) AS cid,
        (SELECT COUNT(*)::int FROM catalogo_medicamentos) AS medicamentos,
        (SELECT COUNT(*)::int FROM catalogo_classes_terapeuticas) AS classes,
        (SELECT COUNT(*)::int FROM catalogo_grupos_risco) AS grupos,
        (SELECT COUNT(*)::int FROM catalogo_met) AS met,
        (SELECT COUNT(*)::int FROM catalogo_comorbidades) AS comorbidades,
        (SELECT COUNT(*)::int FROM knowledge_sources WHERE tipo = 'sistema') AS system_knowledge_rows
    `)

    expect(counts).toEqual({
      cid: 14_793,
      medicamentos: 382,
      classes: 35,
      grupos: 12,
      met: 94,
      comorbidades: 14,
      system_knowledge_rows: 0,
    })
  })

  it('é idempotente pelo hash dos assets', async () => {
    const before = await queryOne<{ carregado_em: string; quantidade: number }>(
      `SELECT carregado_em, quantidade FROM catalogo_seed_state WHERE catalogo = 'clinical-v1'`,
    )
    await seedData()
    const after = await queryOne<{ carregado_em: string; quantidade: number }>(
      `SELECT carregado_em, quantidade FROM catalogo_seed_state WHERE catalogo = 'clinical-v1'`,
    )
    expect(after).toEqual(before)
    expect(after?.quantidade).toBe(15_330)
  })

  it('não cria tabela de paciente e permite nomes duplicados', async () => {
    const patientTable = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name IN ('patient', 'patients', 'pacientes')
      ) AS exists`,
    )
    expect(patientTable?.exists).toBe(false)

    const anamnese = JSON.stringify({ _v: 2, blocos: [] })
    await execute(
      `INSERT INTO registros (id, nome, sexo, idade, plano, anamnese)
       VALUES ('duplicado-1', 'Ana Ribeiro', 'F', 71, 'Convênio', $1::jsonb),
              ('duplicado-2', 'Ana Ribeiro', 'F', 71, 'Convênio', $1::jsonb)`,
      anamnese,
    )
    const count = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM registros WHERE nome = 'Ana Ribeiro'`,
    )
    expect(count?.total).toBe(2)
  })

  it('preserva a memória dormente e não cria tabelas removidas', async () => {
    const tables = await queryOne<{
      knowledge: boolean
      gallery: boolean
      terminal: boolean
    }>(`
      SELECT
        to_regclass('knowledge_sources') IS NOT NULL AS knowledge,
        to_regclass('gallery_images') IS NOT NULL AS gallery,
        to_regclass('terminal_command_log') IS NOT NULL AS terminal
    `)
    expect(tables).toEqual({ knowledge: true, gallery: false, terminal: false })
  })

  it('recusa mutação de um marco da jornada', async () => {
    await execute(
      `INSERT INTO registro_jornada (registro_id, estado, entrou_em)
       VALUES ('duplicado-1', 'aguardando_triagem', '2026-08-13T12:00:00Z')`,
    )
    await expect(
      execute(`UPDATE registro_jornada SET estado = 'na_fila' WHERE registro_id = 'duplicado-1'`),
    ).rejects.toThrow(/append-only/i)
  })
})
