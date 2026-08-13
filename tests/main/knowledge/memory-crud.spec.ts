import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock DB layer — same pattern as ingest-pipeline.spec.ts
// ---------------------------------------------------------------------------
const mockMemorias: Array<{ id: number; conteudo: string; origem: string; criada_em: string; atualizada_em: string }> = []
let idCounter = 0

vi.mock('../../../src/main/db/query', () => ({
  queryAll: vi.fn(async (sql: string) => {
    if (sql.includes('ia_memorias')) return [...mockMemorias]
    return []
  }),
  queryOne: vi.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('COUNT(*)')) {
      return { c: mockMemorias.length }
    }
    if (sql.includes('ia_memorias WHERE id')) {
      const id = params[0] as number
      return mockMemorias.find(m => m.id === id)
    }
    if (sql.includes('ia_memorias LIMIT 1')) {
      return mockMemorias[0]
    }
    if (sql.includes('configuracao_ia')) {
      return { memoria_automatica: true }
    }
    return undefined
  }),
  execute: vi.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('DELETE FROM ia_memorias')) {
      const id = params[0] as number
      const idx = mockMemorias.findIndex(m => m.id === id)
      if (idx !== -1) mockMemorias.splice(idx, 1)
    }
    if (sql.includes('UPDATE ia_memorias SET conteudo')) {
      const id = params[params.length - 1] as number
      const mem = mockMemorias.find(m => m.id === id)
      if (mem) mem.conteudo = params[0] as string
    }
    return { changes: 1 }
  }),
  insertReturningId: vi.fn(async (_sql: string, conteudo: string) => {
    const id = ++idCounter
    mockMemorias.push({
      id,
      conteudo,
      origem: 'manual',
      criada_em: new Date().toISOString(),
      atualizada_em: new Date().toISOString(),
    })
    return id
  }),
  transaction: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  execDDL: vi.fn(async () => {}),
}))

// Mock embeddings — no ONNX model in tests
vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generateQueryEmbedding: vi.fn(async () => null),
  generatePassageEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
}))

// ---------------------------------------------------------------------------
// Helpers that replicate the handler logic from tipc.ts
// (handlers are private closures so we test the DB layer contract directly)
// ---------------------------------------------------------------------------
import {
  queryAll,
  queryOne,
  execute,
  insertReturningId,
} from '../../../src/main/db/query'

const IA_MEMORIAS_LIMIT = 50

async function handlerListar() {
  return queryAll('SELECT * FROM ia_memorias ORDER BY atualizada_em DESC')
}

async function handlerContar() {
  const row = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
  return { total: row?.c ?? 0, limite: IA_MEMORIAS_LIMIT }
}

async function handlerSalvar(input: { id?: number; conteudo: string }) {
  // embedding skipped in tests (returns null from mock)
  if (input.id) {
    await execute(
      'UPDATE ia_memorias SET conteudo = $1, atualizada_em = NOW() WHERE id = $2',
      input.conteudo, input.id,
    )
    return queryOne('SELECT * FROM ia_memorias WHERE id = $1', input.id)
  }
  const countRow = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
  if ((countRow?.c ?? 0) >= IA_MEMORIAS_LIMIT) {
    throw new Error(`Limite de ${IA_MEMORIAS_LIMIT} memórias atingido. Remova uma antes de adicionar.`)
  }
  const id = await insertReturningId(
    `INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'manual')`,
    input.conteudo,
  )
  return queryOne('SELECT * FROM ia_memorias WHERE id = $1', id)
}

async function handlerRemover(input: { id: number }) {
  await execute('DELETE FROM ia_memorias WHERE id = $1', input.id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('memory-crud handlers', () => {
  beforeEach(() => {
    mockMemorias.length = 0
    idCounter = 0
    vi.clearAllMocks()
  })

  // ---- CREATE ---------------------------------------------------------------
  it('create memory → calls INSERT and returns the new record', async () => {
    const mem = await handlerSalvar({ conteudo: 'Usuario de teste nao gosta de segunda-feira' })

    expect(insertReturningId).toHaveBeenCalledOnce()
    const callArgs = (insertReturningId as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toContain('INSERT INTO ia_memorias')
    expect(callArgs[1]).toBe('Usuario de teste nao gosta de segunda-feira')

    expect(mem).toBeDefined()
    expect(mem!.conteudo).toBe('Usuario de teste nao gosta de segunda-feira')
    expect(mem!.id).toBeGreaterThan(0)
  })

  // ---- LIST -----------------------------------------------------------------
  it('list memories → calls SELECT on ia_memorias', async () => {
    // Seed two memories via insertReturningId mock
    await handlerSalvar({ conteudo: 'Memoria 1' })
    await handlerSalvar({ conteudo: 'Memoria 2' })

    vi.clearAllMocks()
    const lista = await handlerListar()

    expect(queryAll).toHaveBeenCalledOnce()
    const sql = (queryAll as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ia_memorias')
    expect(lista).toHaveLength(2)
  })

  // ---- DELETE ---------------------------------------------------------------
  it('delete memory → calls DELETE on ia_memorias with correct id', async () => {
    const mem = await handlerSalvar({ conteudo: 'Para deletar' })
    expect(mem).toBeDefined()

    vi.clearAllMocks()
    await handlerRemover({ id: mem!.id })

    expect(execute).toHaveBeenCalledOnce()
    const [sql, id] = (execute as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain('DELETE FROM ia_memorias')
    expect(id).toBe(mem!.id)
  })

  // ---- COUNT ----------------------------------------------------------------
  it('count → returns total and fixed limit of 50', async () => {
    await handlerSalvar({ conteudo: 'A' })
    await handlerSalvar({ conteudo: 'B' })

    vi.clearAllMocks()
    const result = await handlerContar()

    expect(result.limite).toBe(50)
    expect(result.total).toBe(2)
    expect(queryOne).toHaveBeenCalledOnce()
  })

  // ---- EDIT -----------------------------------------------------------------
  it('edit memory → calls UPDATE with new content', async () => {
    const mem = await handlerSalvar({ conteudo: 'Conteudo original' })
    expect(mem).toBeDefined()

    vi.clearAllMocks()
    const updated = await handlerSalvar({ id: mem!.id, conteudo: 'Conteudo editado' })

    expect(execute).toHaveBeenCalledOnce()
    const [sql, conteudo, id] = (execute as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain('UPDATE ia_memorias SET conteudo')
    expect(conteudo).toBe('Conteudo editado')
    expect(id).toBe(mem!.id)
    expect(updated).toBeDefined()
  })

  // ---- LIMIT ----------------------------------------------------------------
  it('create when at limit → throws error without calling INSERT', async () => {
    // Fill mockMemorias to limit
    for (let i = 0; i < IA_MEMORIAS_LIMIT; i++) {
      mockMemorias.push({
        id: ++idCounter,
        conteudo: `Memoria ${i}`,
        origem: 'manual',
        criada_em: new Date().toISOString(),
        atualizada_em: new Date().toISOString(),
      })
    }

    vi.clearAllMocks()
    await expect(handlerSalvar({ conteudo: 'Overflow' })).rejects.toThrow(
      `Limite de ${IA_MEMORIAS_LIMIT} memórias atingido`,
    )

    expect(insertReturningId).not.toHaveBeenCalled()
  })

  // ---- LIMIT BOUNDARY -------------------------------------------------------
  it('create when at limit - 1 → succeeds (boundary check)', async () => {
    // Fill to limit - 1
    for (let i = 0; i < IA_MEMORIAS_LIMIT - 1; i++) {
      mockMemorias.push({
        id: ++idCounter,
        conteudo: `Memoria ${i}`,
        origem: 'manual',
        criada_em: new Date().toISOString(),
        atualizada_em: new Date().toISOString(),
      })
    }

    vi.clearAllMocks()
    const mem = await handlerSalvar({ conteudo: 'Ultima memoria valida' })
    expect(mem).toBeDefined()
    expect(insertReturningId).toHaveBeenCalledOnce()
  })
})
