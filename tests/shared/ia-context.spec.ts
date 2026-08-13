import { describe, expect, it } from 'vitest'
import {
  IA_CONTEXT_LIMITS,
  IA_CONTEXT_VERSION,
  buildIaContextBundle,
  hashIaContextSelection,
  isIaContextMode,
  type ResolvedIaContextSnapshot,
} from '../../src/shared/ia-context'

const snapshot: ResolvedIaContextSnapshot = {
  version: IA_CONTEXT_VERSION,
  contextId: 'contexto-1',
  requested: {
    version: IA_CONTEXT_VERSION,
    route: '/ia',
    mode: 'pinned',
    registroId: 'registro-1',
    selection: {
      text: 'x'.repeat(IA_CONTEXT_LIMITS.selectionChars + 50),
      from: 0,
      to: 6_050,
      sourceRevision: 1,
      hash: 'hash',
    },
    attachedRegistroIds: [],
    attachedMemoriaIds: [],
    capturedAt: '2026-08-13T12:00:00.000Z',
  },
  resolvedScope: { kind: 'registro', registroIds: ['registro-1'] },
  resolvedAt: '2026-08-13T12:00:00.000Z',
}

describe('contrato genérico de contexto da IA', () => {
  it('mantém os três modos fechados', () => {
    expect(isIaContextMode('global')).toBe(true)
    expect(isIaContextMode('adaptive')).toBe(true)
    expect(isIaContextMode('pinned')).toBe(true)
    expect(isIaContextMode('patient-history')).toBe(false)
  })

  it('gera hash determinístico da seleção', async () => {
    expect(await hashIaContextSelection('trecho')).toBe(await hashIaContextSelection('trecho'))
    expect(await hashIaContextSelection('trecho')).not.toBe(await hashIaContextSelection('outro'))
  })

  it('aplica orçamento sem consultar nenhuma fonte externa', () => {
    const result = buildIaContextBundle(
      snapshot,
      Array.from({ length: 120 }, (_, index) => ({
        id: `memoria-${index}`,
        kind: 'memoria' as const,
        title: `Fonte ${index}`,
        updatedAt: '2026-08-13T12:00:00.000Z',
      })),
      Array.from({ length: 12 }, (_, index) => ({
        sourceId: `source-${index}`,
        title: `Fonte ${index}`,
        snippet: 's'.repeat(2_000),
        citation: `local:${index}`,
      })),
    )

    expect(result.catalog.length).toBeLessThanOrEqual(IA_CONTEXT_LIMITS.catalogItems)
    expect(result.sources.length).toBeLessThanOrEqual(IA_CONTEXT_LIMITS.sources)
    expect(result.budget.selectionChars).toBe(IA_CONTEXT_LIMITS.selectionChars)
    expect(result.budget.catalogChars).toBeLessThanOrEqual(IA_CONTEXT_LIMITS.catalogChars)
    expect(result.budget.sourceChars).toBeLessThanOrEqual(IA_CONTEXT_LIMITS.sourceChars)
    expect(result.budget.totalChars).toBeLessThanOrEqual(IA_CONTEXT_LIMITS.bundleChars)
  })
})
