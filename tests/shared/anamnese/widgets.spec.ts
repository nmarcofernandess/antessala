import {
  AdesaoWidgetDefinition,
  BristolWidgetDefinition,
  HidratacaoWidgetDefinition,
  MedicacoesWidgetDefinition,
  ObservacoesGeraisWidgetDefinition,
  ProblemasSaudeWidgetDefinition,
  RotinaAlimentarWidgetDefinition,
  SonoWidgetDefinition,
  WIDGET_REGISTRY,
  getAvailableWidgetTypes,
} from '../../../src/shared/anamnese'

describe('registry headless da anamnese', () => {
  it('registra exatamente os oito widgets herdados do DietFlow', () => {
    expect(getAvailableWidgetTypes()).toEqual([
      'rotina_alimentar',
      'hidratacao',
      'sono',
      'bristol',
      'problemas_saude',
      'medicacoes',
      'adesao',
      'observacoes_gerais',
    ])
  })

  it('mantém defaults válidos e a semântica de completo/vazio do DietFlow', () => {
    const expectations = {
      rotina_alimentar: { complete: false, empty: true },
      hidratacao: { complete: true, empty: false },
      sono: { complete: true, empty: true },
      bristol: { complete: true, empty: true },
      problemas_saude: { complete: false, empty: true },
      medicacoes: { complete: false, empty: true },
      adesao: { complete: true, empty: true },
      observacoes_gerais: { complete: false, empty: true },
    } as const

    for (const type of getAvailableWidgetTypes()) {
      const definition = WIDGET_REGISTRY[type] as {
        defaultData: unknown
        schema: { safeParse: (value: unknown) => { success: boolean } }
        isComplete: (value: never) => boolean
        isEmpty: (value: never) => boolean
      }
      expect(definition.schema.safeParse(definition.defaultData).success, type).toBe(true)
      expect(definition.isComplete(definition.defaultData as never), type).toBe(expectations[type].complete)
      expect(definition.isEmpty(definition.defaultData as never), type).toBe(expectations[type].empty)
    }
  })
})

describe('renderToText preservado', () => {
  it('renderiza adesão', () => {
    expect(AdesaoWidgetDefinition.renderToText({
      seguiu: 'nao',
      diferencaCalorica: 600,
      diasPeriodo: 7,
      observacao: 'Rever barreiras.',
    })).toContain('Diferença calórica: +600kcal/dia')
  })

  it('renderiza Bristol e sintomas', () => {
    const text = BristolWidgetDefinition.renderToText({
      tipo: 1,
      frequencia: 'irregular',
      sintomas: { gases: { ativo: true, intensidade: 2 } },
    })
    expect(text).toContain('• Bristol: Tipo 1 (constipação)')
    expect(text).toContain('Gases: Moderado')
  })

  it('renderiza hidratação usando somente o peso embutido no widget', () => {
    const text = HidratacaoWidgetDefinition.renderToText({
      litrosDia: 2.5,
      perfil: 'ativo',
      pesoLocal: 70,
      sliderMax: 5,
    })
    expect(text).toContain('• ml/kg: 36ml/kg')
    expect(text).toContain('• Faixa adequada: 2.5-2.8L')
  })

  it('renderiza medicações', () => {
    const text = MedicacoesWidgetDefinition.renderToText({
      medicacoes: [{ id: 'm1', nome: 'Metformina', dose: '850mg', frequencia: '2x_dia' }],
    })
    expect(text).toContain('Metformina 850mg (2x ao dia)')
  })

  it('recusa medicação vazia e a contradição entre lista e "não usa"', () => {
    const itemVazio = { medicacoes: [{ id: 'm1', nome: '   ' }] }
    const contraditorio = {
      medicacoes: [{ id: 'm1', nome: 'Metformina' }],
      naoUsaMedicamentos: true,
    }

    expect(MedicacoesWidgetDefinition.schema.safeParse(itemVazio).success).toBe(false)
    expect(MedicacoesWidgetDefinition.isComplete(itemVazio)).toBe(false)
    expect(MedicacoesWidgetDefinition.renderToText(itemVazio)).toBe('')
    expect(MedicacoesWidgetDefinition.schema.safeParse(contraditorio).success).toBe(false)
    expect(MedicacoesWidgetDefinition.isComplete(contraditorio)).toBe(false)
    expect(MedicacoesWidgetDefinition.renderToText(contraditorio)).toBe('')
  })

  it('renderiza observações rich text sem vazar HTML', () => {
    expect(ObservacoesGeraisWidgetDefinition.renderToText({
      texto: '<p><strong>Avaliar</strong> amanhã</p>',
    })).toBe('OBSERVAÇÕES\n\nAvaliar amanhã')
  })

  it('renderiza problemas de saúde com CID', () => {
    const text = ProblemasSaudeWidgetDefinition.renderToText({
      problemas: [{ id: 'p1', nome: 'Diabetes mellitus', codigo: 'E11', controlado: false }],
    })
    expect(text).toContain('• E11 - Diabetes mellitus')
    expect(text).toContain('Não controlado')
  })

  it('não trata condição vazia como conteúdo clínico', () => {
    const itemVazio = { problemas: [{ id: 'p1', nome: '   ' }] }

    expect(ProblemasSaudeWidgetDefinition.schema.safeParse(itemVazio).success).toBe(false)
    expect(ProblemasSaudeWidgetDefinition.isComplete(itemVazio)).toBe(false)
    expect(ProblemasSaudeWidgetDefinition.isEmpty(itemVazio)).toBe(true)
    expect(ProblemasSaudeWidgetDefinition.renderToText(itemVazio)).toBe('')
    expect(ProblemasSaudeWidgetDefinition.renderToSummary(itemVazio)).toBeNull()
  })

  it('renderiza a rotina agrupada por tipo', () => {
    const text = RotinaAlimentarWidgetDefinition.renderToText({
      registros: [{ id: 'r1', tipo: 'exercicio', titulo: 'Caminhada', horario: '07:00', descricao: '30 minutos' }],
    })
    expect(text).toContain('• Exercícios:')
    expect(text).toContain('Caminhada (07:00): 30 minutos')
  })

  it('renderiza o ISI-7 completo', () => {
    const text = SonoWidgetDefinition.renderToText({
      mode: 'completo',
      satisfacaoSono: 2,
      interferenciaDiurna: 2,
      preocupacaoSono: 2,
      dificuldadeIniciar: 2,
      dificuldadeManter: 1,
      despertarCedo: 1,
      perceptivelOutros: 1,
      horasDormidas: 6,
      acordouNoite: 2,
    })
    expect(text).toContain('SONO (ISI-7 COMPLETO)')
    expect(text).toContain('• Score ISI-7: 11/28 (Insônia leve)')
  })
})
