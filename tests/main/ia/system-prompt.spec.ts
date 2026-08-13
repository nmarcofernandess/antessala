import { describe, it, expect } from 'vitest'
import {
  SYSTEM_PROMPT,
  LOCAL_SYSTEM_PROMPT,
  buildMcpInstructions,
} from '../../../src/main/ia/system-prompt'

describe('SYSTEM_PROMPT', () => {
  it('contains identity section', () => {
    expect(SYSTEM_PROMPT).toMatch(/Identidade|assistente do FlowKit/)
  })

  it('contains golden rules', () => {
    expect(SYSTEM_PROMPT).toMatch(/Regras de Ouro/)
  })

  it('contains the 3 tool families', () => {
    expect(SYSTEM_PROMPT).toContain('consultar_contexto')
    expect(SYSTEM_PROMPT).toContain('editar_ficha')
    expect(SYSTEM_PROMPT).toContain('executar_acao')
  })

  it('documents gallery and terminal actions exposed by tool families', () => {
    expect(SYSTEM_PROMPT).toContain('"galeria"')
    expect(SYSTEM_PROMPT).toContain('"terminal_exec"')
    expect(SYSTEM_PROMPT).toContain('terminal_command_log')
  })

  it('contains workflows section', () => {
    expect(SYSTEM_PROMPT).toMatch(/Workflows|Como buscar/)
  })

  it('contains formatting / PT-BR section', () => {
    expect(SYSTEM_PROMPT).toMatch(/Formatacao|PT-BR/)
  })

  it('contains context briefing section', () => {
    expect(SYSTEM_PROMPT).toMatch(/Context Briefing|briefing/)
  })

  it('has at least 150 lines', () => {
    const lineCount = SYSTEM_PROMPT.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(150)
  })
})

describe('LOCAL_SYSTEM_PROMPT', () => {
  it('contains the 3 tool families', () => {
    expect(LOCAL_SYSTEM_PROMPT).toContain('consultar_contexto')
    expect(LOCAL_SYSTEM_PROMPT).toContain('editar_ficha')
    expect(LOCAL_SYSTEM_PROMPT).toContain('executar_acao')
    expect(LOCAL_SYSTEM_PROMPT).toContain('"galeria"')
    expect(LOCAL_SYSTEM_PROMPT).toContain('"terminal_exec"')
  })

  it('has at least 30 lines', () => {
    const lineCount = LOCAL_SYSTEM_PROMPT.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(30)
  })
})

describe('buildMcpInstructions', () => {
  it('returns string with FlowKit and tools reference', () => {
    const result = buildMcpInstructions()
    expect(typeof result).toBe('string')
    expect(result).toContain('FlowKit')
    expect(result).toMatch(/Ferramentas|tools/i)
  })
})
