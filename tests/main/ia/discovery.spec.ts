import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock DB layer ──────────────────────────────────────────────
const mockQueryOne = vi.fn()
const mockQueryAll = vi.fn()

vi.mock('../../../src/main/db/query', () => ({
    queryOne: (...args: unknown[]) => mockQueryOne(...args),
    queryAll: (...args: unknown[]) => mockQueryAll(...args),
}))

// ─── Mock searchKnowledge ───────────────────────────────────────
const mockSearchKnowledge = vi.fn()

vi.mock('../../../src/main/knowledge/search', () => ({
    searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
}))

// ─── Import after mocks ────────────────────────────────────────
import { buildContextBundle, renderContextBriefing, type ContextBundle } from '../../../src/main/ia/discovery'
import type { IaContexto } from '../../../src/shared/types'

// ─── Helpers ────────────────────────────────────────────────────

function makeContexto(overrides?: Partial<IaContexto>): IaContexto {
    return {
        rota: '/',
        pagina: 'dashboard',
        ...overrides,
    }
}

/** Setup queryOne/queryAll to return counts for the 4 global stats tables */
function setupDbMocks(opts?: {
    sources?: number
    chunks?: number
    entities?: number
    memorias?: number
    memoriasRows?: { id: number; conteudo: string }[]
    knowledgeTitulos?: string[]
}) {
    const {
        sources = 3,
        chunks = 42,
        entities = 7,
        memorias = 2,
        memoriasRows = [
            { id: 1, conteudo: 'User prefers dark mode' },
            { id: 2, conteudo: 'User speaks Portuguese' },
        ],
        knowledgeTitulos = ['Doc A', 'Doc B'],
    } = opts ?? {}

    mockQueryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('knowledge_sources')) return { c: sources, count: sources }
        if (sql.includes('knowledge_chunks')) return { c: chunks, count: chunks }
        if (sql.includes('knowledge_entities')) return { c: entities }
        if (sql.includes('ia_memorias')) return { c: memorias }
        return undefined
    })

    mockQueryAll.mockImplementation(async (sql: string) => {
        if (sql.includes('ia_memorias')) return memoriasRows
        if (sql.includes('knowledge_sources') && sql.includes('titulo')) {
            return knowledgeTitulos.map(t => ({ titulo: t }))
        }
        return []
    })
}

// ─── Tests ──────────────────────────────────────────────────────

describe('discovery — buildContextBundle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when contexto is undefined', async () => {
        const result = await buildContextBundle(undefined)
        expect(result).toBeNull()
    })

    it('returns all expected sections with correct keys', async () => {
        setupDbMocks()
        const bundle = await buildContextBundle(makeContexto())

        expect(bundle).not.toBeNull()
        // Global stats
        expect(bundle!.global).toHaveProperty('knowledge_sources', 3)
        expect(bundle!.global).toHaveProperty('knowledge_chunks', 42)
        expect(bundle!.global).toHaveProperty('knowledge_entities', 7)
        expect(bundle!.global).toHaveProperty('memorias', 2)

        // Knowledge catalog
        expect(bundle!.knowledge_catalogo).toHaveProperty('total_fontes', 3)
        expect(bundle!.knowledge_catalogo).toHaveProperty('total_chunks', 42)
        expect(bundle!.knowledge_catalogo.titulos_top).toEqual(['Doc A', 'Doc B'])

        // Memorias section present
        expect(bundle!.memorias).toBeDefined()
        expect(bundle!.memorias).toContain('dark mode')

        // Rota
        expect(bundle!.rota).toBe('/')
    })

    it('memorias section is undefined when no memorias exist', async () => {
        setupDbMocks({ memorias: 0, memoriasRows: [] })
        const bundle = await buildContextBundle(makeContexto())

        expect(bundle).not.toBeNull()
        expect(bundle!.memorias).toBeUndefined()
    })

    it('rag section is undefined when no user message provided', async () => {
        setupDbMocks()
        const bundle = await buildContextBundle(makeContexto())

        expect(bundle!.rag).toBeUndefined()
    })

    it('rag section is populated when user message triggers search', async () => {
        setupDbMocks()
        mockSearchKnowledge.mockResolvedValueOnce({
            chunks: [{ source_id: 1, score: 0.85 }],
        })
        // queryAll for sources in autoRag
        mockQueryAll.mockImplementation(async (sql: string) => {
            if (sql.includes('ia_memorias')) {
                return [{ id: 1, conteudo: 'some memory' }]
            }
            if (sql.includes('knowledge_sources') && sql.includes('ANY')) {
                return [{ id: 1, titulo: 'My Doc', metadata: '{"context_hint":"about nutrition"}' }]
            }
            if (sql.includes('knowledge_sources') && sql.includes('titulo')) {
                return [{ titulo: 'My Doc' }]
            }
            return []
        })

        const bundle = await buildContextBundle(makeContexto(), 'tell me about nutrition plans')

        expect(bundle!.rag).toBeDefined()
        expect(bundle!.rag).toContain('My Doc')
        expect(bundle!.rag).toContain('nutrition')
    })

    it('page hint matches pagina values (not route paths)', async () => {
        setupDbMocks()

        const pages: Array<{ pagina: IaContexto['pagina']; expected: string }> = [
            { pagina: 'dashboard', expected: 'painel principal' },
            { pagina: 'memoria', expected: 'gerenciando conhecimento' },
            { pagina: 'ia', expected: 'Chat dedicado' },
            { pagina: 'galeria', expected: 'galeria de imagens' },
            { pagina: 'configuracoes', expected: 'configuracoes' },
        ]

        for (const { pagina, expected } of pages) {
            const bundle = await buildContextBundle(makeContexto({ pagina, rota: `/${pagina}` }))
            expect(bundle!.dica_pagina, `page hint for "${pagina}" should contain "${expected}"`).toContain(expected)
        }
    })

    it('page hint is empty string for unknown pagina', async () => {
        setupDbMocks()
        const bundle = await buildContextBundle(makeContexto({ pagina: 'outro' }))
        expect(bundle!.dica_pagina).toBe('')
    })
})

describe('discovery — renderContextBriefing', () => {
    it('produces non-empty markdown with all sections', () => {
        const bundle: ContextBundle = {
            rota: '/memoria',
            memorias: '\n### Memorias (1/50)\n- User likes coffee',
            global: {
                knowledge_sources: 5,
                knowledge_chunks: 100,
                knowledge_entities: 12,
                memorias: 1,
            },
            knowledge_catalogo: {
                total_fontes: 5,
                total_chunks: 100,
                titulos_top: ['Guide A', 'Guide B'],
            },
            dica_pagina: '\nUsuario esta gerenciando conhecimento e memorias.',
        }

        const md = renderContextBriefing(bundle)

        expect(md).toBeTruthy()
        expect(md).toContain('CONTEXTO AUTOMATICO')
        expect(md).toContain('/memoria')
        expect(md).toContain('Fontes de conhecimento: 5')
        expect(md).toContain('Chunks indexados: 100')
        expect(md).toContain('Entidades no grafo: 12')
        expect(md).toContain('Memorias: 1')
        expect(md).toContain('Guide A')
        expect(md).toContain('gerenciando conhecimento')
        expect(md).toContain('User likes coffee')
    })

    it('omits knowledge catalog section when no sources', () => {
        const bundle: ContextBundle = {
            rota: '/',
            global: {
                knowledge_sources: 0,
                knowledge_chunks: 0,
                knowledge_entities: 0,
                memorias: 0,
            },
            knowledge_catalogo: {
                total_fontes: 0,
                total_chunks: 0,
                titulos_top: [],
            },
            dica_pagina: '',
        }

        const md = renderContextBriefing(bundle)

        expect(md).not.toContain('Base de Conhecimento')
    })
})
