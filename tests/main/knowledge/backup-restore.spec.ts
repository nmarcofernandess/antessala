import { describe, it, expect } from 'vitest'
import { BACKUP_CATEGORIAS } from '../../../src/main/backup'

const FLOWKIT_TABLES = [
  'config', 'configuracao_ia',
  'knowledge_sources', 'knowledge_chunks', 'knowledge_entities', 'knowledge_relations',
  'ia_conversas', 'ia_mensagens', 'ia_memorias',
]

const CLT_TABLES = [
  'empresa', 'setores', 'colaboradores', 'escalas',
  'alocacoes', 'demandas', 'feriados',
]

describe('backup', () => {
  it('BACKUP_CATEGORIAS only contains FlowKit tables', () => {
    const allTables = Object.values(BACKUP_CATEGORIAS).flat()
    for (const table of allTables) {
      expect(FLOWKIT_TABLES, `"${table}" is not a known FlowKit table`).toContain(table)
    }
  })

  it('no CLT tables in backup categories', () => {
    const allTables = Object.values(BACKUP_CATEGORIAS).flat()
    for (const clt of CLT_TABLES) {
      expect(allTables, `CLT table "${clt}" found in BACKUP_CATEGORIAS`).not.toContain(clt)
    }
  })

  it('BACKUP_CATEGORIAS covers all expected FlowKit tables', () => {
    const allTables = new Set(Object.values(BACKUP_CATEGORIAS).flat())
    // Every table listed in FLOWKIT_TABLES should appear in at least one category
    for (const table of FLOWKIT_TABLES) {
      expect(allTables, `FlowKit table "${table}" is missing from BACKUP_CATEGORIAS`).toContain(table)
    }
  })

  it('BACKUP_CATEGORIAS has expected category structure', () => {
    expect(BACKUP_CATEGORIAS).toHaveProperty('conhecimento')
    expect(BACKUP_CATEGORIAS).toHaveProperty('conversas')
    expect(BACKUP_CATEGORIAS).toHaveProperty('memorias')
    expect(BACKUP_CATEGORIAS).toHaveProperty('config')
  })

  it('conhecimento category has knowledge tables', () => {
    expect(BACKUP_CATEGORIAS.conhecimento).toContain('knowledge_sources')
    expect(BACKUP_CATEGORIAS.conhecimento).toContain('knowledge_chunks')
    expect(BACKUP_CATEGORIAS.conhecimento).toContain('knowledge_entities')
    expect(BACKUP_CATEGORIAS.conhecimento).toContain('knowledge_relations')
  })

  it('conversas category has ia_conversas and ia_mensagens', () => {
    expect(BACKUP_CATEGORIAS.conversas).toContain('ia_conversas')
    expect(BACKUP_CATEGORIAS.conversas).toContain('ia_mensagens')
  })

  it('memorias category has ia_memorias', () => {
    expect(BACKUP_CATEGORIAS.memorias).toContain('ia_memorias')
  })

  it('config category has configuracao_ia and config', () => {
    expect(BACKUP_CATEGORIAS.config).toContain('configuracao_ia')
    expect(BACKUP_CATEGORIAS.config).toContain('config')
  })
})
