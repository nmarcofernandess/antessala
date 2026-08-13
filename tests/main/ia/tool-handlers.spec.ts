import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: DB layer
// ---------------------------------------------------------------------------
const queryAll = vi.fn()
const queryOne = vi.fn()
const execute = vi.fn()
const insertReturningId = vi.fn()

vi.mock('../../../src/main/db/query', () => ({
  queryAll,
  queryOne,
  execute,
  insertReturningId,
}))

// ---------------------------------------------------------------------------
// Mock: knowledge/search
// ---------------------------------------------------------------------------
const searchKnowledge = vi.fn()
const exploreRelations = vi.fn()

vi.mock('../../../src/main/knowledge/search', () => ({
  searchKnowledge,
  exploreRelations,
}))

// ---------------------------------------------------------------------------
// Mock: knowledge/ingest
// ---------------------------------------------------------------------------
const ingestKnowledge = vi.fn()

vi.mock('../../../src/main/knowledge/ingest', () => ({
  ingestKnowledge,
}))

// ---------------------------------------------------------------------------
// Mock: knowledge/embeddings (dynamic import in salvar_memoria)
// ---------------------------------------------------------------------------
const generateQueryEmbedding = vi.fn()

vi.mock('../../../src/main/knowledge/embeddings', () => ({
  generateQueryEmbedding,
}))

// ---------------------------------------------------------------------------
// Mock: backup (dynamic import in fazer_backup)
// ---------------------------------------------------------------------------
const createSnapshot = vi.fn()

vi.mock('../../../src/main/backup', () => ({
  createSnapshot,
}))

// ---------------------------------------------------------------------------
// Mock: terminal harness
// ---------------------------------------------------------------------------
const runTerminalCommandWithConfig = vi.fn()

vi.mock('../../../src/main/terminal/harness', () => ({
  runTerminalCommandWithConfig,
}))

// ---------------------------------------------------------------------------
// Mock: electron (used by fazer_backup + broadcastInvalidation)
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => '/tmp/test-userdata'),
      getVersion: vi.fn(() => '0.1.0'),
    },
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

// ---------------------------------------------------------------------------
// Mock: zod-to-json-schema (avoid runtime issues in test env)
// ---------------------------------------------------------------------------
vi.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: vi.fn(() => ({ type: 'object', properties: {} })),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
let executeTool: typeof import('../../../src/main/ia/tools').executeTool
let getVercelAiFamilyTools: typeof import('../../../src/main/ia/tools').getVercelAiFamilyTools
let IA_TOOLS: typeof import('../../../src/main/ia/tools').IA_TOOLS

beforeEach(async () => {
  vi.clearAllMocks()
  // Re-import to get fresh references bound to mocks
  const mod = await import('../../../src/main/ia/tools')
  executeTool = mod.executeTool
  getVercelAiFamilyTools = mod.getVercelAiFamilyTools
  IA_TOOLS = mod.IA_TOOLS
})

// ===========================================================================
// 1. buscar_conhecimento
// ===========================================================================

describe('buscar_conhecimento', () => {
  it('returns toolOk with results when chunks found', async () => {
    searchKnowledge.mockResolvedValueOnce({
      chunks: [
        { id: 1, source_id: 1, conteudo: 'Chunk one', score: 0.85, importance: 'high' },
        { id: 2, source_id: 1, conteudo: 'Chunk two', score: 0.72, importance: 'low' },
      ],
      relations: [],
      context_for_llm: 'some context',
    })

    const result = await executeTool('buscar_conhecimento', { consulta: 'test query' })

    expect(result.status).toBe('ok')
    expect(result.total).toBe(2)
    expect(result.melhor_score).toBe(0.85)
    expect(result.context_for_llm).toBe('some context')
    expect(searchKnowledge).toHaveBeenCalledWith('test query', { limite: 5 })
  })

  it('returns toolOk with empty results when no chunks', async () => {
    searchKnowledge.mockResolvedValueOnce({
      chunks: [],
      relations: [],
      context_for_llm: '',
    })

    const result = await executeTool('buscar_conhecimento', { consulta: 'nothing here' })

    expect(result.status).toBe('ok')
    expect(result.chunks).toEqual([])
    expect(result.melhor_score).toBe(0)
  })

  it('returns toolError on exception', async () => {
    searchKnowledge.mockRejectedValueOnce(new Error('Embedding offline'))

    const result = await executeTool('buscar_conhecimento', { consulta: 'fail' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('BUSCAR_CONHECIMENTO_FALHOU')
  })

  it('rejects empty consulta via Zod validation', async () => {
    const result = await executeTool('buscar_conhecimento', { consulta: '' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('INVALID_TOOL_ARGUMENTS')
  })
})

// ===========================================================================
// 2. explorar_relacoes
// ===========================================================================

describe('explorar_relacoes', () => {
  it('returns toolOk with graph data', async () => {
    exploreRelations.mockResolvedValueOnce({
      entidade_raiz: 'FlowKit',
      entidades: [
        { nome: 'FlowKit', tipo: 'projeto', nivel: 0 },
        { nome: 'React', tipo: 'tecnologia', nivel: 1 },
      ],
      relacoes: [
        { from_nome: 'FlowKit', to_nome: 'React', tipo_relacao: 'usa', peso: 1.0 },
      ],
    })

    const result = await executeTool('explorar_relacoes', { entidade: 'FlowKit' })

    expect(result.status).toBe('ok')
    expect(result.entidade_raiz).toBe('FlowKit')
    expect(result.entidades).toHaveLength(2)
    expect(result.relacoes).toHaveLength(1)
    expect(exploreRelations).toHaveBeenCalledWith('FlowKit', 2)
  })

  it('returns toolError when entity not found', async () => {
    exploreRelations.mockResolvedValueOnce({
      entidade_raiz: null,
      entidades: [],
      relacoes: [],
    })

    const result = await executeTool('explorar_relacoes', { entidade: 'Inexistente' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('NOT_FOUND')
  })

  it('returns toolError on exception', async () => {
    exploreRelations.mockRejectedValueOnce(new Error('DB down'))

    const result = await executeTool('explorar_relacoes', { entidade: 'FlowKit' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('EXPLORAR_RELACOES_FALHOU')
  })
})

// ===========================================================================
// 3. listar_conhecimento
// ===========================================================================

describe('listar_conhecimento', () => {
  it('returns toolOk with sources and stats', async () => {
    const mockSources = [
      { id: 1, tipo: 'manual', titulo: 'Doc 1', importance: 'high', criada_em: '2026-01-01', atualizada_em: '2026-01-02' },
      { id: 2, tipo: 'auto_capture', titulo: 'Doc 2', importance: 'low', criada_em: '2026-01-01', atualizada_em: '2026-01-03' },
    ]

    // queryAll for sources list
    queryAll.mockResolvedValueOnce(mockSources)
    // queryOne for stats (4 calls)
    queryOne
      .mockResolvedValueOnce({ c: 10 })  // total_sources
      .mockResolvedValueOnce({ c: 50 })  // total_chunks
      .mockResolvedValueOnce({ c: 20 })  // total_entities
      .mockResolvedValueOnce({ c: 15 })  // total_relations

    const result = await executeTool('listar_conhecimento', {})

    expect(result.status).toBe('ok')
    expect(result.sources).toHaveLength(2)
    expect(result.stats.total_sources).toBe(10)
    expect(result.stats.total_chunks).toBe(50)
    expect(result.stats.total_entities).toBe(20)
    expect(result.stats.total_relations).toBe(15)
  })

  it('passes tipo filter when specified', async () => {
    queryAll.mockResolvedValueOnce([])
    queryOne
      .mockResolvedValueOnce({ c: 0 })
      .mockResolvedValueOnce({ c: 0 })
      .mockResolvedValueOnce({ c: 0 })
      .mockResolvedValueOnce({ c: 0 })

    await executeTool('listar_conhecimento', { tipo: 'manual', limite: 10 })

    // When tipo != 'todos', queryAll receives tipo + limite
    expect(queryAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tipo = $1'),
      'manual',
      10,
    )
  })
})

// ===========================================================================
// 4. status_sistema
// ===========================================================================

describe('status_sistema', () => {
  it('returns toolOk with all stats', async () => {
    queryOne
      .mockResolvedValueOnce({ c: 5 })   // knowledge_sources
      .mockResolvedValueOnce({ c: 25 })  // knowledge_chunks
      .mockResolvedValueOnce({ c: 12 })  // knowledge_entities
      .mockResolvedValueOnce({ c: 8 })   // knowledge_relations
      .mockResolvedValueOnce({ c: 3 })   // ia_memorias

    const result = await executeTool('status_sistema', {})

    expect(result.status).toBe('ok')
    expect(result.stats.knowledge_sources).toBe(5)
    expect(result.stats.knowledge_chunks).toBe(25)
    expect(result.stats.knowledge_entities).toBe(12)
    expect(result.stats.knowledge_relations).toBe(8)
    expect(result.stats.memorias).toBe(3)
  })

  it('returns toolError on exception', async () => {
    queryOne.mockRejectedValueOnce(new Error('DB offline'))

    const result = await executeTool('status_sistema', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('STATUS_SISTEMA_FALHOU')
  })
})

// ===========================================================================
// 5. salvar_memoria
// ===========================================================================

describe('salvar_memoria', () => {
  it('creates new memory with embedding', async () => {
    generateQueryEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3])
    queryOne.mockResolvedValueOnce({ c: 5 }) // count
    insertReturningId.mockResolvedValueOnce(6)

    const result = await executeTool('salvar_memoria', { conteudo: 'Test fact' })

    expect(result.status).toBe('ok')
    expect(result.id).toBe(6)
    expect(result.conteudo).toBe('Test fact')
    expect(result.total).toBe(6)
    expect(insertReturningId).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ia_memorias'),
      'Test fact',
      expect.stringContaining('[0.1,0.2,0.3]'),
    )
  })

  it('updates existing memory when id provided', async () => {
    generateQueryEmbedding.mockResolvedValueOnce([0.1, 0.2])
    queryOne
      .mockResolvedValueOnce({ c: 10 })     // count
      .mockResolvedValueOnce({ id: 3 })      // exists check

    const result = await executeTool('salvar_memoria', { conteudo: 'Updated fact', id: 3 })

    expect(result.status).toBe('ok')
    expect(result.id).toBe(3)
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ia_memorias'),
      'Updated fact',
      expect.any(String),
      3,
    )
  })

  it('returns error when limit reached (50)', async () => {
    generateQueryEmbedding.mockResolvedValueOnce(null)
    queryOne.mockResolvedValueOnce({ c: 50 }) // count at limit

    const result = await executeTool('salvar_memoria', { conteudo: 'One too many' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('LIMITE_MEMORIAS')
  })

  it('returns error when updating non-existent id', async () => {
    generateQueryEmbedding.mockResolvedValueOnce(null)
    queryOne
      .mockResolvedValueOnce({ c: 5 })       // count
      .mockResolvedValueOnce(undefined)        // exists check -> not found

    const result = await executeTool('salvar_memoria', { conteudo: 'nope', id: 999 })

    expect(result.status).toBe('error')
    expect(result.code).toBe('NOT_FOUND')
  })
})

// ===========================================================================
// 6. remover_memoria
// ===========================================================================

describe('remover_memoria', () => {
  it('removes memory and returns remaining count', async () => {
    queryOne
      .mockResolvedValueOnce({ id: 5 })      // exists check
      .mockResolvedValueOnce({ c: 4 })        // remaining count

    const result = await executeTool('remover_memoria', { id: 5 })

    expect(result.status).toBe('ok')
    expect(result.id).toBe(5)
    expect(result.total).toBe(4)
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM ia_memorias'),
      5,
    )
  })

  it('returns NOT_FOUND for non-existent memory', async () => {
    queryOne.mockResolvedValueOnce(undefined) // not found

    const result = await executeTool('remover_memoria', { id: 999 })

    expect(result.status).toBe('error')
    expect(result.code).toBe('NOT_FOUND')
  })
})

// ===========================================================================
// 7. salvar_conhecimento
// ===========================================================================

describe('salvar_conhecimento', () => {
  it('calls ingestKnowledge and returns toolOk', async () => {
    ingestKnowledge.mockResolvedValueOnce({
      source_id: 42,
      chunks_count: 3,
      entities_count: 2,
    })

    const result = await executeTool('salvar_conhecimento', {
      titulo: 'Test Doc',
      conteudo: 'Some important content here.',
    })

    expect(result.status).toBe('ok')
    expect(result.source_id).toBe(42)
    expect(result.chunks_count).toBe(3)
    expect(result.entities_count).toBe(2)
    expect(ingestKnowledge).toHaveBeenCalledWith('Test Doc', 'Some important content here.', 'high')
  })

  it('returns toolError on ingest failure', async () => {
    ingestKnowledge.mockRejectedValueOnce(new Error('Chunking failed'))

    const result = await executeTool('salvar_conhecimento', {
      titulo: 'Bad Doc',
      conteudo: 'Content that fails.',
    })

    expect(result.status).toBe('error')
    expect(result.code).toBe('SALVAR_CONHECIMENTO_FALHOU')
  })
})

// ===========================================================================
// 8. toggle_fonte (not a direct tool — tested via listar + context)
//    Note: toggle_fonte is not in IA_TOOLS. The spec mentions it but
//    it doesn't exist as a tool handler. We test it returns UNKNOWN_TOOL.
// ===========================================================================

describe('toggle_fonte (not implemented as tool)', () => {
  it('returns UNKNOWN_TOOL error', async () => {
    const result = await executeTool('toggle_fonte', { id: 1, ativo: false })

    expect(result.status).toBe('error')
    expect(result.code).toBe('UNKNOWN_TOOL')
  })
})

// ===========================================================================
// 9. enriquecer (not in IA_TOOLS — tested as UNKNOWN)
// ===========================================================================

describe('enriquecer (not implemented as tool)', () => {
  it('returns UNKNOWN_TOOL error', async () => {
    const result = await executeTool('enriquecer', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('UNKNOWN_TOOL')
  })
})

// ===========================================================================
// 10. reconstruir_grafo (not in IA_TOOLS — tested as UNKNOWN)
// ===========================================================================

describe('reconstruir_grafo (not implemented as tool)', () => {
  it('returns UNKNOWN_TOOL error', async () => {
    const result = await executeTool('reconstruir_grafo', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('UNKNOWN_TOOL')
  })
})

// ===========================================================================
// 11. fazer_backup
// ===========================================================================

describe('fazer_backup', () => {
  it('calls createSnapshot and returns toolOk', async () => {
    createSnapshot.mockResolvedValueOnce({
      meta: {
        criado_em: '2026-04-01T12:00:00Z',
        registros: 100,
      },
      tamanho_bytes: 51200,
    })

    const result = await executeTool('fazer_backup', {})

    expect(result.status).toBe('ok')
    expect(result.mensagem).toBe('Backup criado com sucesso')
    expect(result.tamanho_kb).toBe(50)
    expect(result.total_registros).toBe(100)
    expect(createSnapshot).toHaveBeenCalledWith(
      'ia',
      '/tmp/test-userdata',
      '0.1.0',
      { scope: 'operational' },
    )
  })

  it('returns error when backup already in progress', async () => {
    createSnapshot.mockResolvedValueOnce(null)

    const result = await executeTool('fazer_backup', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('BACKUP_IN_PROGRESS')
  })

  it('returns error on backup failure', async () => {
    createSnapshot.mockRejectedValueOnce(new Error('Disk full'))

    const result = await executeTool('fazer_backup', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('BACKUP_FALHOU')
  })
})

// ===========================================================================
// 12. terminal_exec
// ===========================================================================

describe('terminal_exec', () => {
  it('runs terminal harness and returns toolOk', async () => {
    runTerminalCommandWithConfig.mockResolvedValueOnce({
      status: 'ok',
      audit: { logged: true },
      config: {
        default_cwd: '/tmp',
        max_timeout_ms: 30000,
        max_output_chars: 20000,
      },
      result: {
        command: 'pwd',
        cwd: '/tmp',
        exit_code: 0,
        signal: null,
        stdout: '/tmp\n',
        stderr: '',
        duration_ms: 12,
        timed_out: false,
      },
    })

    const result = await executeTool('terminal_exec', { command: 'pwd', cwd: '/tmp' })

    expect(result.status).toBe('ok')
    expect(result.result.stdout).toBe('/tmp\n')
    expect(result.audit).toEqual({ logged: true })
    expect(runTerminalCommandWithConfig).toHaveBeenCalledWith({
      command: 'pwd',
      cwd: '/tmp',
      timeout_ms: 30000,
      max_output_chars: 20000,
    }, 'ia_tool')
  })
})

// ===========================================================================
// Unknown tool
// ===========================================================================

describe('unknown tool', () => {
  it('returns UNKNOWN_TOOL error', async () => {
    const result = await executeTool('nao_existe', { foo: 'bar' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('UNKNOWN_TOOL')
  })
})

// ===========================================================================
// Zod validation (schema enforcement)
// ===========================================================================

describe('Zod schema validation', () => {
  it('rejects remover_memoria without id', async () => {
    const result = await executeTool('remover_memoria', {})

    expect(result.status).toBe('error')
    expect(result.code).toBe('INVALID_TOOL_ARGUMENTS')
  })

  it('rejects salvar_conhecimento without titulo', async () => {
    const result = await executeTool('salvar_conhecimento', { conteudo: 'text' })

    expect(result.status).toBe('error')
    expect(result.code).toBe('INVALID_TOOL_ARGUMENTS')
  })

  it('rejects buscar_conhecimento with invalid limite', async () => {
    const result = await executeTool('buscar_conhecimento', { consulta: 'test', limite: 999 })

    expect(result.status).toBe('error')
    expect(result.code).toBe('INVALID_TOOL_ARGUMENTS')
  })
})

// ===========================================================================
// getVercelAiFamilyTools — 3 family tools
// ===========================================================================

describe('getVercelAiFamilyTools', () => {
  it('returns exactly 3 family tools', () => {
    const tools = getVercelAiFamilyTools()
    const names = Object.keys(tools)

    expect(names).toHaveLength(3)
    expect(names).toContain('consultar_contexto')
    expect(names).toContain('editar_ficha')
    expect(names).toContain('executar_acao')
  })

  it('each tool has description, inputSchema, and execute function', () => {
    const tools = getVercelAiFamilyTools()

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, `${name} missing description`).toBeTruthy()
      expect(tool.inputSchema, `${name} missing inputSchema`).toBeTruthy()
      expect(typeof tool.execute, `${name} missing execute`).toBe('function')
    }
  })

  it('consultar_contexto.execute routes to buscar_conhecimento', async () => {
    searchKnowledge.mockResolvedValueOnce({
      chunks: [{ id: 1, source_id: 1, conteudo: 'data', score: 0.9, importance: 'high' }],
      relations: [],
      context_for_llm: 'ctx',
    })

    const tools = getVercelAiFamilyTools()
    const result = await tools.consultar_contexto.execute({
      entidade: 'conhecimento',
      filtros: { consulta: 'hello' },
    })

    expect(result.status).toBe('ok')
    expect(searchKnowledge).toHaveBeenCalledWith('hello', expect.objectContaining({}))
  })

  it('editar_ficha.execute routes to salvar_memoria', async () => {
    generateQueryEmbedding.mockResolvedValueOnce(null)
    queryOne.mockResolvedValueOnce({ c: 0 }) // count
    insertReturningId.mockResolvedValueOnce(1)

    const tools = getVercelAiFamilyTools()
    const result = await tools.editar_ficha.execute({
      entidade: 'memoria',
      operacao: 'criar',
      dados: { conteudo: 'New memory' },
    })

    expect(result.status).toBe('ok')
    expect(insertReturningId).toHaveBeenCalled()
  })

  it('executar_acao.execute routes to fazer_backup', async () => {
    createSnapshot.mockResolvedValueOnce({
      meta: { criado_em: '2026-04-01', registros: 10 },
      tamanho_bytes: 1024,
    })

    const tools = getVercelAiFamilyTools()
    const result = await tools.executar_acao.execute({
      acao: 'backup',
      args: {},
    })

    expect(result.status).toBe('ok')
    expect(result.mensagem).toBe('Backup criado com sucesso')
  })

  it('executar_acao.execute routes to terminal_exec', async () => {
    runTerminalCommandWithConfig.mockResolvedValueOnce({
      status: 'ok',
      audit: { logged: true },
      config: {
        default_cwd: '/tmp',
        max_timeout_ms: 30000,
        max_output_chars: 20000,
      },
      result: {
        command: 'pwd',
        cwd: '/tmp',
        exit_code: 0,
        signal: null,
        stdout: '/tmp\n',
        stderr: '',
        duration_ms: 12,
        timed_out: false,
      },
    })

    const tools = getVercelAiFamilyTools()
    const result = await tools.executar_acao.execute({
      acao: 'terminal_exec',
      args: { command: 'pwd', cwd: '/tmp' },
    })

    expect(result.status).toBe('ok')
    expect(runTerminalCommandWithConfig).toHaveBeenCalled()
  })
})

// ===========================================================================
// IA_TOOLS registry
// ===========================================================================

describe('IA_TOOLS registry', () => {
  it('contains exactly 11 tool definitions', () => {
    expect(IA_TOOLS).toHaveLength(11)
  })

  it('each tool has name, description, and parameters', () => {
    for (const tool of IA_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.parameters).toBeDefined()
      expect(tool.parameters.type).toBe('object')
    }
  })

  it('includes all expected tool names', () => {
    const names = IA_TOOLS.map(t => t.name)
    expect(names).toContain('buscar_conhecimento')
    expect(names).toContain('salvar_conhecimento')
    expect(names).toContain('explorar_relacoes')
    expect(names).toContain('listar_conhecimento')
    expect(names).toContain('salvar_memoria')
    expect(names).toContain('remover_memoria')
    expect(names).toContain('fazer_backup')
    expect(names).toContain('terminal_exec')
    expect(names).toContain('status_sistema')
  })
})
