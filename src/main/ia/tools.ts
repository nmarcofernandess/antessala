import { createRequire } from 'node:module'
import { queryOne, queryAll, execute, insertReturningId } from '../db/query'
import { searchKnowledge, exploreRelations } from '../knowledge/search'
import { galleryListar } from '../gallery/service'
import { ingestKnowledge } from '../knowledge/ingest'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// ==================== HELPER: Zod → JSON Schema (Type-Safe) ====================

/**
 * Converte schema Zod para JSON Schema compatível com Gemini API.
 *
 * NOTA: O `as any` é necessário por incompatibilidade de tipos entre
 * zod@4.x e zod-to-json-schema@3.x. A conversão funciona perfeitamente
 * em runtime, mas TypeScript não reconhece a compatibilidade.
 *
 * IMPORTANTE: Remove o campo `$schema` que zod-to-json-schema adiciona
 * por padrão, pois Gemini API não aceita esse campo.
 *
 * Centralizar aqui permite:
 * - Usar schemas Zod com type-safety total
 * - Isolar o hack de tipo em UM lugar só
 * - Facilitar migração futura se necessário
 */
function toJsonSchema<T extends z.ZodTypeAny>(schema: T): Record<string, any> {
  // Zod v4 has native JSON Schema generation. Prefer it because zod-to-json-schema
  // can degrade to "{}" with some zod v4 schemas depending on runtime compatibility.
  const nativeToJsonSchema = (z as any).toJSONSchema
  const jsonSchema = typeof nativeToJsonSchema === 'function'
    ? nativeToJsonSchema(schema)
    : zodToJsonSchema(schema as any)
  // Remove $schema que Gemini API não aceita
  delete jsonSchema.$schema
  return jsonSchema
}

type ToolMeta = Record<string, unknown>

function toolOk<T extends Record<string, any>>(
  payload: T,
  options?: { summary?: string; meta?: ToolMeta }
) {
  return {
    status: 'ok' as const,
    ...(options?.summary ? { summary: options.summary } : {}),
    ...payload,
    ...(options?.meta ? { _meta: options.meta } : {}),
  }
}

function toolError(
  code: string,
  message: string,
  options?: { correction?: string; meta?: ToolMeta; details?: Record<string, unknown> }
) {
  return {
    status: 'error' as const,
    code,
    message,
    // Compat com UI/fluxos legados que procuram "erro"
    erro: message,
    ...(options?.correction ? { correction: options.correction } : {}),
    ...(options?.details ?? {}),
    ...(options?.meta ? { _meta: options.meta } : {}),
  }
}

function toolTruncated<T extends Record<string, any>>(
  payload: T,
  options?: { summary?: string; meta?: ToolMeta }
) {
  return {
    status: 'truncated' as const,
    ...(options?.summary ? { summary: options.summary } : {}),
    ...payload,
    ...(options?.meta ? { _meta: options.meta } : {}),
  }
}

// ---------------------------------------------------------------------------
// Broadcast de invalidação — notifica renderer que dados mudaram (via IA tools)
// ---------------------------------------------------------------------------
let _BrowserWindow: typeof import('electron').BrowserWindow | undefined
try {
  const requireElectron = createRequire(import.meta.url)
  _BrowserWindow = (requireElectron('electron') as typeof import('electron')).BrowserWindow
} catch { /* vitest / non-electron env */ }

function broadcastInvalidation(entidades: string[]) {
  if (!_BrowserWindow?.getAllWindows) return
  for (const win of _BrowserWindow.getAllWindows()) {
    win.webContents.send('data:invalidated', { entidades })
  }
}

// ==================== ZOD SCHEMAS (Knowledge Tools) ====================

// buscar_conhecimento
const BuscarConhecimentoSchema = z.object({
  consulta: z.string().min(1).describe('Texto da pergunta ou termos para buscar na base de conhecimento.'),
  limite: z.number().int().min(1).max(10).default(5).describe('Máximo de resultados.'),
})

// salvar_conhecimento
const SalvarConhecimentoSchema = z.object({
  titulo: z.string().min(1).describe('Título descritivo do conhecimento.'),
  conteudo: z.string().min(1).describe('Texto completo a ser indexado.'),
  importance: z.enum(['high', 'low']).default('high').describe('high=salvamento explícito do usuário, low=auto-capture pela IA.'),
})

// listar_conhecimento
const ListarConhecimentoSchema = z.object({
  tipo: z.enum(['todos', 'manual', 'auto_capture']).default('todos').describe('Filtro por tipo de fonte.'),
  limite: z.number().int().min(1).max(50).default(20).describe('Máximo de fontes.'),
})

// explorar_relacoes
const ExplorarRelacoesSchema = z.object({
  entidade: z.string().min(1).describe('Nome da entidade a explorar no knowledge graph.'),
  profundidade: z.number().int().min(1).max(3).default(2).describe('Profundidade do traversal no grafo (1-3). Padrão: 2.'),
})

// ==================== MEMÓRIAS IA ====================

const SalvarMemoriaSchema = z.object({
  conteudo: z.string().min(1).describe('Fato curto a memorizar.'),
  id: z.number().int().positive().optional().describe('ID da memória a atualizar. Se omitido, cria nova.'),
})

const RemoverMemoriaSchema = z.object({
  id: z.number().int().positive().describe('ID da memória a remover.'),
})

const FazerBackupSchema = z.object({})

const TerminalExecSchema = z.object({
  command: z.string().min(1).describe('Comando shell a executar no computador local.'),
  cwd: z.string().optional().describe('Diretorio de trabalho. Se omitido, usa o cwd do app.'),
  timeout_ms: z.number().int().min(100).max(120_000).default(30_000).describe('Timeout em milissegundos. Maximo 120000.'),
  max_output_chars: z.number().int().min(1000).max(200_000).default(20_000).describe('Limite de caracteres de saida retornados para a IA.'),
})

// ==================== STATUS SISTEMA ====================

const StatusSistemaSchema = z.object({})

// ==================== GALLERY TOOLS ====================

const ListarGaleriaSchema = z.object({
  origem: z.string().optional().describe('Filtrar por origem: upload, ai_generated, extracted, screenshot, chat.'),
  limite: z.number().int().min(1).max(50).default(20).describe('Máximo de imagens a retornar.'),
})

const AnalisarImagemSchema = z.object({})

// ==================== IA_TOOLS (Gemini API Format) ====================

export const IA_TOOLS = [
    {
        name: 'buscar_conhecimento',
        description: 'Busca semântica na base de conhecimento (RAG). Retorna chunks relevantes + relações do knowledge graph.',
        parameters: toJsonSchema(BuscarConhecimentoSchema)
    },
    {
        name: 'salvar_conhecimento',
        description: 'Salva conhecimento na base de conhecimento. importance=high: salvamento explícito do usuário. importance=low: auto-capture pela IA.',
        parameters: toJsonSchema(SalvarConhecimentoSchema)
    },
    {
        name: 'explorar_relacoes',
        description: 'Explora relações no knowledge graph a partir de uma entidade.',
        parameters: toJsonSchema(ExplorarRelacoesSchema)
    },
    {
        name: 'listar_conhecimento',
        description: 'Lista fontes na base de conhecimento com stats do sistema.',
        parameters: toJsonSchema(ListarConhecimentoSchema)
    },
    {
        name: 'salvar_memoria',
        description: 'Salva uma memória curta (max 50). Use quando o usuário diz "lembra que...", "anota que...".',
        parameters: toJsonSchema(SalvarMemoriaSchema)
    },
    {
        name: 'remover_memoria',
        description: 'Remove uma memória por id.',
        parameters: toJsonSchema(RemoverMemoriaSchema)
    },
    {
        name: 'fazer_backup',
        description: 'Cria um snapshot (backup) do estado atual do sistema.',
        parameters: toJsonSchema(FazerBackupSchema)
    },
    {
        name: 'terminal_exec',
        description: 'Executa comando shell no computador local via Terminal Harness. Use com cuidado; retorna stdout/stderr/exit_code.',
        parameters: toJsonSchema(TerminalExecSchema)
    },
    {
        name: 'status_sistema',
        description: 'Retorna estatísticas do sistema: fontes, chunks, embeddings, memórias.',
        parameters: toJsonSchema(StatusSistemaSchema)
    },
    {
        name: 'listar_galeria',
        description: 'Lista imagens na galeria. Filtra por origem (upload, ai_generated, extracted, screenshot, chat).',
        parameters: toJsonSchema(ListarGaleriaSchema)
    },
    {
        name: 'analisar_imagem',
        description: 'Analisa uma imagem da galeria com IA (stub — requer Gemini Embedding 2, expansão futura).',
        parameters: toJsonSchema(AnalisarImagemSchema)
    },
]

// ==================== VALIDAÇÃO RUNTIME (Zod) ====================

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny | null> = {
  buscar_conhecimento: BuscarConhecimentoSchema,
  salvar_conhecimento: SalvarConhecimentoSchema,
  listar_conhecimento: ListarConhecimentoSchema,
  explorar_relacoes: ExplorarRelacoesSchema,
  salvar_memoria: SalvarMemoriaSchema,
  remover_memoria: RemoverMemoriaSchema,
  fazer_backup: FazerBackupSchema,
  terminal_exec: TerminalExecSchema,
  status_sistema: StatusSistemaSchema,
  listar_galeria: ListarGaleriaSchema,
  analisar_imagem: AnalisarImagemSchema,
}

// ==================== VERCEL AI SDK FORMAT ====================

/**
 * Converte tools pro formato Vercel AI SDK.
 * Reutiliza schemas Zod + executeTool().
 */
export function getVercelAiTools() {
    const tools: Record<string, any> = {}

    for (const t of IA_TOOLS) {
        const zodSchema = TOOL_SCHEMAS[t.name] || z.object({})

        tools[t.name] = {
            description: t.description,
            parameters: zodSchema,
            execute: async (args: Record<string, any>) => {
                return await executeTool(t.name, args)
            }
        }
    }

    return tools
}

// ==================== TOOL HANDLERS ====================

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
    // ==================== VALIDAÇÃO ZOD RUNTIME ====================
    const schema = TOOL_SCHEMAS[name]
    if (schema) {
        const validation = schema.safeParse(args)
        if (!validation.success) {
            const errors = validation.error.issues.map((issue) => {
                const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
                return `  • ${path}: ${issue.message}`
            }).join('\n')
            return toolError(
              'INVALID_TOOL_ARGUMENTS',
              `Validação falhou para tool '${name}':\n\n${errors}\n\nVerifique os tipos e valores permitidos.`,
              {
                correction: 'Corrija os argumentos com base no schema da tool e tente novamente.',
                meta: { tool_name: name, stage: 'schema-validation' }
              }
            )
        }
        // Se válido, usar validated data (garantido type-safe)
        args = validation.data as Record<string, any>
    }

    // ==================== KNOWLEDGE TOOLS ====================

    if (name === 'buscar_conhecimento') {
        const { consulta, limite } = args
        try {
            const result = await searchKnowledge(consulta as string, { limite: limite as number | undefined })
            if (result.chunks.length === 0) {
                return toolOk(
                  { chunks: [], relations: [], context_for_llm: '', melhor_score: 0, sugestao_refinamento: 'Nenhum resultado. Reformule com sinônimos ou termos mais específicos.' },
                  { summary: 'Nenhum conhecimento encontrado para esta busca.', meta: { tool_kind: 'knowledge' } }
                )
            }
            const melhor_score = Math.max(...result.chunks.map(c => c.score))
            return toolOk(
              {
                total: result.chunks.length,
                melhor_score: Number(melhor_score.toFixed(2)),
                context_for_llm: result.context_for_llm,
                sugestao_refinamento: melhor_score < 0.5
                  ? 'Score baixo. Tente reformular com sinônimos ou termos alternativos e busque novamente.'
                  : null,
              },
              { summary: `${result.chunks.length} resultado(s) encontrado(s) (melhor score: ${melhor_score.toFixed(2)}).`, meta: { tool_kind: 'knowledge' } }
            )
        } catch (e: any) {
            return toolError('BUSCAR_CONHECIMENTO_FALHOU', `Erro na busca: ${e.message}`, { correction: 'Tente reformular a consulta ou use termos mais específicos.', meta: { tool_kind: 'knowledge' } })
        }
    }

    if (name === 'salvar_conhecimento') {
        const { titulo, conteudo, importance } = args
        try {
            const result = await ingestKnowledge(titulo as string, conteudo as string, importance as 'high' | 'low')
            return toolOk(
              { source_id: result.source_id, chunks_count: result.chunks_count, entities_count: result.entities_count },
              { summary: `Conhecimento salvo: ${result.chunks_count} chunk(s)${result.entities_count > 0 ? `, ${result.entities_count} entidade(s) extraída(s)` : ''}.`, meta: { tool_kind: 'knowledge' } }
            )
        } catch (e: any) {
            return toolError('SALVAR_CONHECIMENTO_FALHOU', `Erro ao salvar: ${e.message}`, { correction: 'Verifique se título e conteúdo não estão vazios e tente novamente.', meta: { tool_kind: 'knowledge' } })
        }
    }

    if (name === 'listar_conhecimento') {
        const { tipo, limite } = args
        try {
            const sources = tipo === 'todos'
              ? await queryAll<{ id: number; tipo: string; titulo: string; importance: string; criada_em: string; atualizada_em: string }>(
                  'SELECT id, tipo, titulo, importance, criada_em, atualizada_em FROM knowledge_sources ORDER BY atualizada_em DESC LIMIT $1',
                  limite as number,
                )
              : await queryAll<{ id: number; tipo: string; titulo: string; importance: string; criada_em: string; atualizada_em: string }>(
                  'SELECT id, tipo, titulo, importance, criada_em, atualizada_em FROM knowledge_sources WHERE tipo = $1 ORDER BY atualizada_em DESC LIMIT $2',
                  tipo as string,
                  limite as number,
                )

            // Stats
            const totalSources = (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_sources'))?.c ?? 0
            const totalChunks = (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_chunks'))?.c ?? 0
            const totalEntities = (await queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM knowledge_entities WHERE valid_to IS NULL"))?.c ?? 0
            const totalRelations = (await queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM knowledge_relations WHERE valid_to IS NULL"))?.c ?? 0

            return toolOk(
              {
                sources,
                stats: { total_sources: totalSources, total_chunks: totalChunks, total_entities: totalEntities, total_relations: totalRelations },
              },
              { summary: `${sources.length} fonte(s) listada(s) de ${totalSources} total. ${totalChunks} chunks, ${totalEntities} entidades, ${totalRelations} relações.`, meta: { tool_kind: 'knowledge' } }
            )
        } catch (e: any) {
            return toolError('LISTAR_CONHECIMENTO_FALHOU', `Erro: ${e.message}`, { correction: 'Tente sem filtro de tipo.', meta: { tool_kind: 'knowledge' } })
        }
    }

    if (name === 'explorar_relacoes') {
        const { entidade, profundidade } = args
        try {
            const result = await exploreRelations(entidade as string, (profundidade as number) ?? 2)
            if (!result.entidade_raiz) {
                return toolError('NOT_FOUND', `Entidade "${entidade}" não encontrada no knowledge graph.`, {
                    correction: 'Verifique o nome exato. O graph só contém entidades extraídas de documentos indexados.',
                    meta: { tool_kind: 'knowledge' }
                })
            }
            return toolOk(
              { entidade_raiz: result.entidade_raiz, entidades: result.entidades, relacoes: result.relacoes },
              {
                summary: `Grafo explorado para "${result.entidade_raiz}": ${result.entidades.length} entidade(s), ${result.relacoes.length} relação(ões).`,
                meta: { tool_kind: 'knowledge' }
              }
            )
        } catch (e: any) {
            return toolError('EXPLORAR_RELACOES_FALHOU', `Erro ao explorar relações: ${e.message}`, {
                correction: 'Verifique o nome da entidade e tente novamente.',
                meta: { tool_kind: 'knowledge' }
            })
        }
    }

    // ==================== MEMÓRIAS IA ====================

    if (name === 'salvar_memoria') {
        const { conteudo, id } = args as { conteudo: string; id?: number }
        try {
            const { generateQueryEmbedding } = await import('../knowledge/embeddings')
            const countRow = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
            const total = countRow?.c ?? 0

            // Gera embedding local (grátis)
            let embeddingStr: string | null = null
            try {
                const embedding = await generateQueryEmbedding(conteudo)
                if (embedding) embeddingStr = `[${embedding.join(',')}]`
            } catch { /* embedding falhou, salva sem */ }

            // Update
            if (id) {
                const existe = await queryOne<{ id: number }>('SELECT id FROM ia_memorias WHERE id = $1', id)
                if (!existe) {
                    return toolError('NOT_FOUND', `Memória #${id} não encontrada.`, {
                        correction: 'Consulte as memórias no contexto automático (já injetadas) para ver os IDs disponíveis.',
                        meta: { tool_kind: 'memoria' }
                    })
                }
                if (embeddingStr) {
                    await execute('UPDATE ia_memorias SET conteudo = $1, embedding = $2::vector, atualizada_em = NOW() WHERE id = $3', conteudo, embeddingStr, id)
                } else {
                    await execute('UPDATE ia_memorias SET conteudo = $1, atualizada_em = NOW() WHERE id = $2', conteudo, id)
                }
                return toolOk(
                    { id, conteudo, total },
                    { summary: `Memória #${id} atualizada.`, meta: { tool_kind: 'memoria' } }
                )
            }

            // Create — check limit
            if (total >= 50) {
                return toolError('LIMITE_MEMORIAS', `Limite de 50 memórias atingido (${total}/50).`, {
                    correction: 'Consulte as memórias no contexto automático (já injetadas) e use remover_memoria para liberar espaço.',
                    meta: { tool_kind: 'memoria' }
                })
            }

            const newId = embeddingStr
                ? await insertReturningId(`INSERT INTO ia_memorias (conteudo, origem, embedding) VALUES ($1, 'manual', $2::vector)`, conteudo, embeddingStr)
                : await insertReturningId(`INSERT INTO ia_memorias (conteudo, origem) VALUES ($1, 'manual')`, conteudo)
            return toolOk(
                { id: newId, conteudo, total: total + 1 },
                { summary: `Memória salva (${total + 1}/50): "${conteudo.slice(0, 50)}..."`, meta: { tool_kind: 'memoria' } }
            )
        } catch (e: any) {
            return toolError('SALVAR_MEMORIA_FALHOU', `Erro ao salvar memória: ${e.message}`, {
                correction: 'Tente novamente.',
                meta: { tool_kind: 'memoria' }
            })
        }
    }

    if (name === 'remover_memoria') {
        const { id } = args as { id: number }
        try {
            const existe = await queryOne<{ id: number }>('SELECT id FROM ia_memorias WHERE id = $1', id)
            if (!existe) {
                return toolError('NOT_FOUND', `Memória #${id} não encontrada.`, {
                    correction: 'Consulte as memórias no contexto automático (já injetadas) para ver os IDs disponíveis.',
                    meta: { tool_kind: 'memoria' }
                })
            }
            await execute('DELETE FROM ia_memorias WHERE id = $1', id)
            const countRow = await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias')
            return toolOk(
                { id, total: countRow?.c ?? 0 },
                { summary: `Memória #${id} removida.`, meta: { tool_kind: 'memoria' } }
            )
        } catch (e: any) {
            return toolError('REMOVER_MEMORIA_FALHOU', `Erro ao remover memória: ${e.message}`, {
                correction: 'Tente novamente.',
                meta: { tool_kind: 'memoria' }
            })
        }
    }

    if (name === 'fazer_backup') {
        try {
            const { createSnapshot } = await import('../backup')
            const electron = await import('electron')
            const info = await createSnapshot('ia', electron.default.app.getPath('userData'), electron.default.app.getVersion(), { scope: 'operational' })
            if (!info) return toolError('BACKUP_IN_PROGRESS', 'Backup ja em andamento, tente novamente em alguns segundos')
            return toolOk({
                mensagem: 'Backup criado com sucesso',
                criado_em: info.meta.criado_em,
                tamanho_kb: Math.round(info.tamanho_bytes / 1024),
                total_registros: info.meta.registros,
            })
        } catch (e: any) {
            return toolError('BACKUP_FALHOU', `Erro ao criar backup: ${e.message}`, {
                correction: 'Tente novamente.',
            })
        }
    }

    if (name === 'terminal_exec') {
        const { command, cwd, timeout_ms, max_output_chars } = args as { command: string; cwd?: string; timeout_ms?: number; max_output_chars?: number }
        try {
            const { runTerminalCommandWithConfig } = await import('../terminal/harness')
            const execResult = await runTerminalCommandWithConfig({ command, cwd, timeout_ms, max_output_chars }, 'ia_tool')
            const result = execResult.result
            return toolOk(
              { result, audit: execResult.audit },
              {
                summary: `Terminal terminou com exit_code ${result.exit_code}${result.timed_out ? ' (timeout)' : ''}.`,
                meta: { tool_kind: 'terminal' },
              },
            )
        } catch (e: any) {
            return toolError('TERMINAL_EXEC_FALHOU', `Erro ao executar terminal: ${e.message}`, {
                correction: 'Verifique command/cwd/timeout e tente novamente.',
                meta: { tool_kind: 'terminal' },
            })
        }
    }

    // ==================== STATUS SISTEMA ====================

    if (name === 'status_sistema') {
        try {
            const totalSources = (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_sources'))?.c ?? 0
            const totalChunks = (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_chunks'))?.c ?? 0
            const totalEntities = (await queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM knowledge_entities WHERE valid_to IS NULL"))?.c ?? 0
            const totalRelations = (await queryOne<{ c: number }>("SELECT COUNT(*)::int as c FROM knowledge_relations WHERE valid_to IS NULL"))?.c ?? 0
            const totalMemorias = (await queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias'))?.c ?? 0

            return toolOk(
              {
                message: 'Status do sistema: funcional',
                stats: {
                  knowledge_sources: totalSources,
                  knowledge_chunks: totalChunks,
                  knowledge_entities: totalEntities,
                  knowledge_relations: totalRelations,
                  memorias: totalMemorias,
                },
              },
              { summary: 'Sistema FlowKit operacional', meta: { tool_kind: 'system' } }
            )
        } catch (e: any) {
            return toolError('STATUS_SISTEMA_FALHOU', `Erro ao obter status: ${e.message}`, {
                correction: 'Tente novamente.',
                meta: { tool_kind: 'system' }
            })
        }
    }

    // ==================== GALLERY TOOLS ====================

    if (name === 'listar_galeria') {
        const { origem, limite } = args
        try {
            const images = await galleryListar({ origem: origem as string, limite: (limite as number) ?? 20 })
            return toolOk(
              { total: images.length, imagens: images.map(i => ({ id: i.id, nome: i.nome_original, origem: i.origem, favorito: i.favorito, tags: i.tags })) },
              { summary: `${images.length} imagem(ns) na galeria.`, meta: { tool_kind: 'gallery' } }
            )
        } catch (e: any) {
            return toolError('GALERIA_ERRO', e.message, { meta: { tool_kind: 'gallery' } })
        }
    }

    if (name === 'analisar_imagem') {
        return toolOk(
          { status: 'not_implemented' },
          { summary: 'Analise de imagem requer Gemini Embedding 2 (expansao futura). Use listar_galeria para ver imagens disponiveis.', meta: { tool_kind: 'gallery' } }
        )
    }

    return toolError('UNKNOWN_TOOL', `Tool '${name}' não reconhecida.`, {
      correction: 'Use apenas tools declaradas em IA_TOOLS.',
      meta: { tool_name: name }
    })
}

// ==================== FAMILY TOOLS (3 tools LLM-facing) ====================

import { FAMILY_TOOLS, FAMILY_SCHEMAS, routeFamilyTool } from './tool-families'
import { tool as aiTool } from 'ai'

/**
 * Registry publico com 3 family tools (JSON Schema).
 * Substitui IA_TOOLS no surface LLM — menos tokens, mesma cobertura.
 */
export const IA_TOOLS_PUBLIC = FAMILY_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: toJsonSchema(FAMILY_SCHEMAS[t.name]),
}))

/**
 * Converte family tools pro formato Vercel AI SDK.
 * Reutiliza schemas Zod + executeFamilyTool().
 */
export function getVercelAiFamilyTools() {
    const tools: Record<string, any> = {}
    for (const t of FAMILY_TOOLS) {
        const zodSchema = FAMILY_SCHEMAS[t.name]
        tools[t.name] = (aiTool as any)({
            description: t.description,
            inputSchema: zodSchema as any,
            execute: async (args: Record<string, any>) => {
                const route = routeFamilyTool(t.name, args)
                if (route.internalTool === 'UNKNOWN') {
                    return toolError('UNKNOWN_ACTION', `Acao desconhecida: ${JSON.stringify(args)}`, {
                        correction: 'Verifique o nome da acao ou entidade.',
                    })
                }
                return await executeTool(route.internalTool, route.internalArgs)
            }
        })
    }
    return tools
}
