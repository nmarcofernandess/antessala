import { queryOne, queryAll } from '../db/query'
import { searchKnowledge } from '../knowledge/search'
import type { IaContexto } from '../../shared/types'

// ─── Context Bundle Types ────────────────────────────────────────
export interface ContextBundle {
    rota: string
    memorias?: string
    rag?: string
    global: {
        knowledge_sources: number
        knowledge_chunks: number
        knowledge_entities: number
        memorias: number
    }
    knowledge_catalogo: {
        total_fontes: number
        total_chunks: number
        titulos_top: string[]
    }
    dica_pagina: string
}

/**
 * Auto-discovery: dado o contexto da página atual do usuário,
 * busca dados relevantes do DB e monta um briefing de texto
 * que é injetado no system instruction.
 */

// =============================================================================
// buildContextBundle — monta o ContextBundle estruturado
// =============================================================================
export async function buildContextBundle(contexto?: IaContexto, mensagemUsuario?: string): Promise<ContextBundle | null> {
    if (!contexto) return null

    // ─── Global ─────────────────────────────────────────────────────
    const global = await _resumoGlobal()

    // ─── Memórias ───────────────────────────────────────────────────
    const memorias = await _memorias()

    // ─── Auto-RAG ───────────────────────────────────────────────────
    let rag: string | undefined
    if (mensagemUsuario && mensagemUsuario.trim().length > 10) {
        rag = (await _autoRag(mensagemUsuario)) ?? undefined
    }

    // ─── Knowledge catálogo ─────────────────────────────────────────
    const knowledge_catalogo = await _statsKnowledgeBundle(global)

    // ─── Dica de página ─────────────────────────────────────────────
    const dica_pagina = _dicaPagina(contexto.pagina)

    return {
        rota: contexto.rota,
        memorias: memorias ?? undefined,
        rag,
        global,
        knowledge_catalogo,
        dica_pagina,
    }
}

// =============================================================================
// renderContextBriefing — converte ContextBundle em markdown
// =============================================================================
export function renderContextBriefing(bundle: ContextBundle): string {
    const sections: string[] = []

    sections.push(`## CONTEXTO AUTOMATICO — PAGINA ATUAL DO USUARIO`)
    sections.push(`Rota: ${bundle.rota}`)

    if (bundle.memorias) sections.push(bundle.memorias)
    if (bundle.rag) sections.push(bundle.rag)

    sections.push(`\n### Resumo do sistema`)
    sections.push(`- Fontes de conhecimento: ${bundle.global.knowledge_sources}`)
    sections.push(`- Chunks indexados: ${bundle.global.knowledge_chunks}`)
    sections.push(`- Entidades no grafo: ${bundle.global.knowledge_entities}`)
    sections.push(`- Memorias: ${bundle.global.memorias}`)

    // Base de Conhecimento (expandida com títulos)
    const kc = bundle.knowledge_catalogo
    if (kc.total_fontes > 0) {
        sections.push(`\n### Base de Conhecimento`)
        sections.push(`- ${kc.total_fontes} fonte(s) | ${kc.total_chunks} chunks indexados`)
        if (kc.titulos_top.length > 0) {
            sections.push(`- Fontes recentes: ${kc.titulos_top.join(', ')}`)
        }
    }

    sections.push(bundle.dica_pagina)

    return sections.join('\n')
}

// =============================================================================
// buildContextBriefing — wrapper mantendo assinatura original
// =============================================================================
export async function buildContextBriefing(contexto?: IaContexto, mensagemUsuario?: string): Promise<string> {
    const bundle = await buildContextBundle(contexto, mensagemUsuario)
    if (!bundle) return ''
    return renderContextBriefing(bundle)
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

async function _resumoGlobal() {
    const [sources, chunks, entities, memorias] = await Promise.all([
        queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_sources'),
        queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_chunks'),
        queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM knowledge_entities WHERE valid_to IS NULL'),
        queryOne<{ c: number }>('SELECT COUNT(*)::int as c FROM ia_memorias'),
    ])
    return {
        knowledge_sources: sources?.c ?? 0,
        knowledge_chunks: chunks?.c ?? 0,
        knowledge_entities: entities?.c ?? 0,
        memorias: memorias?.c ?? 0,
    }
}

async function _autoRag(query: string): Promise<string | null> {
    try {
        const result = await searchKnowledge(query, { limite: 3 })
        if (result.chunks.length === 0) return null

        const bestScore = Math.max(...result.chunks.map(c => c.score))

        // Sobe pro nível da source: só título + context_hint (leve, ~300 chars total)
        const sourceIds = [...new Set(result.chunks.map(c => c.source_id))]
        const sources = await queryAll<{ id: number; titulo: string; metadata: string }>(
            `SELECT id, titulo, metadata::text as metadata FROM knowledge_sources WHERE id = ANY($1)`,
            sourceIds,
        )
        if (sources.length === 0) return null

        const lines = sources.map(s => {
            let hint = ''
            try {
                const meta = JSON.parse(s.metadata)
                hint = meta.context_hint ?? ''
            } catch { /* */ }
            return hint
                ? `- **${s.titulo}**: ${hint}`
                : `- **${s.titulo}**`
        })

        const confianca = Math.round(bestScore * 100)
        const header = confianca >= 60
            ? `### Conhecimento relevante (confianca: ${confianca}%)`
            : `### Conhecimento relevante (confianca baixa: ${confianca}% — use consultar_contexto com entidade "conhecimento" e query reformulada para melhores resultados)`

        return `\n${header}\n${lines.join('\n')}`
    } catch (err) {
        console.warn('[discovery._autoRag]', (err as Error).message)
        return null
    }
}

async function _memorias(): Promise<string | null> {
    try {
        const rows = await queryAll<{ id: number; conteudo: string }>('SELECT id, conteudo FROM ia_memorias ORDER BY atualizada_em DESC LIMIT 50')
        if (rows.length === 0) return null
        const lines = rows.map(m => `- ${m.conteudo}`)
        return `\n### Memorias (${rows.length}/50)\n${lines.join('\n')}`
    } catch {
        return null
    }
}

async function _statsKnowledgeBundle(global: ContextBundle['global']): Promise<ContextBundle['knowledge_catalogo']> {
    try {
        const titulosRows = await queryAll<{ titulo: string }>('SELECT titulo FROM knowledge_sources ORDER BY atualizada_em DESC LIMIT 5')
        return {
            total_fontes: global.knowledge_sources,
            total_chunks: global.knowledge_chunks,
            titulos_top: titulosRows.map(r => r.titulo),
        }
    } catch {
        return { total_fontes: 0, total_chunks: 0, titulos_top: [] }
    }
}

const PAGE_HINTS: Record<string, string> = {
    'dashboard': '\nUsuario esta no painel principal.',
    'memoria': '\nUsuario esta gerenciando conhecimento e memorias.',
    'ia': '\nChat dedicado com IA.',
    'configuracoes': '\nUsuario esta nas configuracoes.',
}

function _dicaPagina(pagina: string): string {
    return PAGE_HINTS[pagina] || ''
}

// =============================================================================
// ALERTAS — kept for interface compat (coreAlerts used by tipc or other modules)
// =============================================================================

export interface AlertaCore {
    tipo: string
    severidade: 'CRITICAL' | 'WARNING' | 'INFO'
    codigo?: string
    mensagem: string
}

export async function coreAlerts(): Promise<AlertaCore[]> {
    // Nenhum alerta de domínio é produzido por esta camada dormente.
    return []
}
