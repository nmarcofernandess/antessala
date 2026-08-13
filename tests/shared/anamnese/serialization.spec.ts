import {
  ACTIVE_ANAMNESE_TEMPLATES,
  AnamneseValidationError,
  LEGACY_DIETFLOW_BASIC_TEMPLATE,
  createEmptyAnamnese,
  createLegacyDietFlowBasicAnamnese,
  createWidgetBlock,
  deserializeAnamneseContent,
  serializeAnamneseContent,
} from '../../../src/shared/anamnese'

describe('serialização da anamnese', () => {
  it('usa o envelope {_v: 2, blocos} e valida cada widget no round-trip', () => {
    let nextId = 0
    const content = createLegacyDietFlowBasicAnamnese(() => `bloco-${++nextId}`)
    const serialized = serializeAnamneseContent(content)
    const parsed = deserializeAnamneseContent(serialized)

    expect(parsed._v).toBe(2)
    expect(parsed.blocos).toHaveLength(8)
    expect(serializeAnamneseContent(parsed)).toBe(serialized)
  })

  it('recusa dados que violam o schema do widget', () => {
    const bloco = createWidgetBlock('hidratacao', 'hidratacao-1')
    bloco.data = { litrosDia: 30, sliderMax: 5 }

    expect(() => serializeAnamneseContent({ _v: 2, blocos: [bloco] }))
      .toThrowError(/hidratacao.*dados inválidos/i)
  })

  it('recusa widgets desconhecidos e JSON quebrado', () => {
    expect(() => deserializeAnamneseContent({
      _v: 2,
      blocos: [{
        id: 'x',
        type: 'widget',
        widgetType: 'inventado',
        data: {},
        convertidoParaTexto: false,
      }],
    })).toThrowError(AnamneseValidationError)

    expect(() => deserializeAnamneseContent('{quebrado'))
      .toThrowError('JSON de anamnese inválido')
  })

  it('clona defaults ao criar blocos', () => {
    const first = createWidgetBlock('medicacoes', 'm1')
    const second = createWidgetBlock('medicacoes', 'm2')
    ;(first.data.medicacoes as unknown[]).push({ id: 'x', nome: 'Teste' })
    expect(second.data.medicacoes).toEqual([])
  })
})

describe('templates', () => {
  it('deixa o catálogo ativo vazio até hack/specs/02-quais-widgets', () => {
    expect(ACTIVE_ANAMNESE_TEMPLATES).toEqual([])
    expect(ACTIVE_ANAMNESE_TEMPLATES).not.toContain(LEGACY_DIETFLOW_BASIC_TEMPLATE)
    expect(createEmptyAnamnese()).toEqual({ _v: 2, blocos: [] })
  })

  it('mantém a básica do DietFlow somente como referência legada explícita', () => {
    expect(LEGACY_DIETFLOW_BASIC_TEMPLATE.widgetTypes).toHaveLength(8)
    expect(LEGACY_DIETFLOW_BASIC_TEMPLATE.id).toContain('legado')
  })
})
