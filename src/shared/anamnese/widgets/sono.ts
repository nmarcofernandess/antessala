import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const ISILikertSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
])
export const AcordouNoiteSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
])

export const SonoDataSchema = z.object({
  mode: z.enum(['triagem', 'completo']).default('triagem'),
  satisfacaoSono: ISILikertSchema.default(1),
  interferenciaDiurna: ISILikertSchema.default(1),
  preocupacaoSono: ISILikertSchema.default(1),
  dificuldadeIniciar: ISILikertSchema.optional(),
  dificuldadeManter: ISILikertSchema.optional(),
  despertarCedo: ISILikertSchema.optional(),
  perceptivelOutros: ISILikertSchema.optional(),
  horasDormidas: z.number().min(0).max(14).optional(),
  acordouNoite: AcordouNoiteSchema.optional(),
})

export type ISILikert = z.infer<typeof ISILikertSchema>
export type AcordouNoite = z.infer<typeof AcordouNoiteSchema>
export type SonoData = z.infer<typeof SonoDataSchema>
export type SonoMode = SonoData['mode']
export type ISI3Classification = 'adequate' | 'attention' | 'probable' | 'significant'
export type ISI7Classification = 'none' | 'mild' | 'moderate' | 'severe'

export interface ISI3Result {
  score: number
  classification: ISI3Classification
  label: string
  status: 'optimal' | 'adequate' | 'attention' | 'critical'
  suggestFullISI: boolean
}

export interface ISI7Result {
  score: number
  classification: ISI7Classification
  label: string
  status: 'optimal' | 'adequate' | 'attention' | 'critical'
  recommendation: string
}

export const SONO_DEFAULT_DATA: SonoData = {
  mode: 'triagem',
  satisfacaoSono: 1,
  interferenciaDiurna: 1,
  preocupacaoSono: 1,
  horasDormidas: 7,
  acordouNoite: 0,
}

export const SATISFACAO_SONO_OPTIONS = [
  { value: 0 as const, label: 'Muito satisfeito' },
  { value: 1 as const, label: 'Satisfeito' },
  { value: 2 as const, label: 'Neutro' },
  { value: 3 as const, label: 'Insatisfeito' },
  { value: 4 as const, label: 'Muito insatisfeito' },
]
export const INTERFERENCIA_DIURNA_OPTIONS = [
  { value: 0 as const, label: 'Nenhuma' },
  { value: 1 as const, label: 'Pouca' },
  { value: 2 as const, label: 'Alguma' },
  { value: 3 as const, label: 'Muita' },
  { value: 4 as const, label: 'Muito' },
]
export const PREOCUPACAO_SONO_OPTIONS = [
  { value: 0 as const, label: 'Nenhuma' },
  { value: 1 as const, label: 'Pouca' },
  { value: 2 as const, label: 'Alguma' },
  { value: 3 as const, label: 'Muita' },
  { value: 4 as const, label: 'Muito' },
]
export const DIFICULDADE_INICIAR_OPTIONS = [
  { value: 0 as const, label: 'Nenhuma' },
  { value: 1 as const, label: 'Leve' },
  { value: 2 as const, label: 'Moderada' },
  { value: 3 as const, label: 'Grave' },
  { value: 4 as const, label: 'Muito grave' },
]
export const DIFICULDADE_MANTER_OPTIONS = DIFICULDADE_INICIAR_OPTIONS
export const DESPERTAR_CEDO_OPTIONS = [
  { value: 0 as const, label: 'Não' },
  { value: 1 as const, label: 'Leve' },
  { value: 2 as const, label: 'Moderado' },
  { value: 3 as const, label: 'Grave' },
  { value: 4 as const, label: 'Muito grave' },
]
export const PERCEPTIVEL_OUTROS_OPTIONS = [
  { value: 0 as const, label: 'Nada' },
  { value: 1 as const, label: 'Pouco' },
  { value: 2 as const, label: 'Razoável' },
  { value: 3 as const, label: 'Muito' },
  { value: 4 as const, label: 'Muito perceptível' },
]
export const ACORDOU_NOITE_OPTIONS = [
  { value: 0 as const, label: 'Não' },
  { value: 1 as const, label: '1x' },
  { value: 2 as const, label: '2x' },
  { value: 3 as const, label: '3+' },
]

function optionLabel<T extends number>(options: ReadonlyArray<{ value: T; label: string }>, value: T): string {
  return options.find((option) => option.value === value)?.label ?? String(value)
}

export const getSatisfacaoLabel = (value: ISILikert): string => optionLabel(SATISFACAO_SONO_OPTIONS, value)
export const getInterferenciaLabel = (value: ISILikert): string => optionLabel(INTERFERENCIA_DIURNA_OPTIONS, value)
export const getPreocupacaoLabel = (value: ISILikert): string => optionLabel(PREOCUPACAO_SONO_OPTIONS, value)
export const getDificuldadeIniciarLabel = (value: ISILikert): string => optionLabel(DIFICULDADE_INICIAR_OPTIONS, value)
export const getDificuldadeManterLabel = (value: ISILikert): string => optionLabel(DIFICULDADE_MANTER_OPTIONS, value)
export const getDespertarCedoLabel = (value: ISILikert): string => optionLabel(DESPERTAR_CEDO_OPTIONS, value)
export const getPerceptivelOutrosLabel = (value: ISILikert): string => optionLabel(PERCEPTIVEL_OUTROS_OPTIONS, value)
export const getAcordouNoiteLabel = (value: AcordouNoite): string => optionLabel(ACORDOU_NOITE_OPTIONS, value)

export function calcularISI3(data: SonoData): ISI3Result {
  const score = data.satisfacaoSono + data.interferenciaDiurna + data.preocupacaoSono
  if (score <= 3) return { score, classification: 'adequate', label: 'Sono adequado', status: 'optimal', suggestFullISI: false }
  if (score <= 6) return { score, classification: 'attention', label: 'Atenção', status: 'adequate', suggestFullISI: false }
  if (score <= 9) return { score, classification: 'probable', label: 'Insônia provável', status: 'attention', suggestFullISI: true }
  return { score, classification: 'significant', label: 'Insônia significativa', status: 'critical', suggestFullISI: true }
}

export function calcularISI7(data: SonoData): ISI7Result {
  const score =
    (data.dificuldadeIniciar ?? 0) +
    (data.dificuldadeManter ?? 0) +
    (data.despertarCedo ?? 0) +
    data.satisfacaoSono +
    data.interferenciaDiurna +
    (data.perceptivelOutros ?? 0) +
    data.preocupacaoSono

  if (score <= 7) return { score, classification: 'none', label: 'Sem insônia clínica', status: 'optimal', recommendation: 'Manter rotina de sono saudável' }
  if (score <= 14) return { score, classification: 'mild', label: 'Insônia leve', status: 'adequate', recommendation: 'Revisar higiene do sono' }
  if (score <= 21) return { score, classification: 'moderate', label: 'Insônia moderada', status: 'attention', recommendation: 'Intervenção recomendada' }
  return { score, classification: 'severe', label: 'Insônia severa', status: 'critical', recommendation: 'Encaminhamento especializado' }
}

export function isISI7Complete(data: SonoData): boolean {
  return data.dificuldadeIniciar !== undefined &&
    data.dificuldadeManter !== undefined &&
    data.despertarCedo !== undefined &&
    data.perceptivelOutros !== undefined
}

export function isSonoEmpty(data: SonoData): boolean {
  return data.mode === SONO_DEFAULT_DATA.mode &&
    data.satisfacaoSono === SONO_DEFAULT_DATA.satisfacaoSono &&
    data.interferenciaDiurna === SONO_DEFAULT_DATA.interferenciaDiurna &&
    data.preocupacaoSono === SONO_DEFAULT_DATA.preocupacaoSono &&
    (data.horasDormidas === undefined || data.horasDormidas === SONO_DEFAULT_DATA.horasDormidas) &&
    (data.acordouNoite === undefined || data.acordouNoite === SONO_DEFAULT_DATA.acordouNoite) &&
    data.dificuldadeIniciar === undefined &&
    data.dificuldadeManter === undefined &&
    data.despertarCedo === undefined &&
    data.perceptivelOutros === undefined
}

export function renderSonoToText(data: SonoData): string {
  if (isSonoEmpty(data)) return ''

  if (data.mode === 'completo') {
    const isi7 = calcularISI7(data)
    const lines: Array<string | null> = [
      TextFormatter.sectionTitle('Sono (ISI-7 Completo)'),
      'DIFICULDADES:',
      TextFormatter.field('Iniciar', getDificuldadeIniciarLabel(data.dificuldadeIniciar ?? 0)),
      TextFormatter.field('Manter', getDificuldadeManterLabel(data.dificuldadeManter ?? 0)),
      TextFormatter.field('Despertar cedo', getDespertarCedoLabel(data.despertarCedo ?? 0)),
      'IMPACTO:',
      TextFormatter.field('Satisfação', getSatisfacaoLabel(data.satisfacaoSono)),
      TextFormatter.field('Interferência', getInterferenciaLabel(data.interferenciaDiurna)),
      TextFormatter.field('Perceptível', getPerceptivelOutrosLabel(data.perceptivelOutros ?? 0)),
      TextFormatter.field('Preocupação', getPreocupacaoLabel(data.preocupacaoSono)),
      TextFormatter.field('Score ISI-7', `${isi7.score}/28 (${isi7.label})`),
      TextFormatter.field('Recomendação', isi7.recommendation),
    ]
    if (data.horasDormidas !== undefined) lines.push(TextFormatter.field('Horas/noite', `${data.horasDormidas}h`))
    if (data.acordouNoite !== undefined && data.acordouNoite > 0) lines.push(TextFormatter.field('Despertares', getAcordouNoiteLabel(data.acordouNoite)))
    return TextFormatter.join(lines)
  }

  const isi3 = calcularISI3(data)
  const lines: Array<string | null> = [
    TextFormatter.sectionTitle('Sono (ISI-3 Triagem)'),
    TextFormatter.field('Score ISI-3', `${isi3.score}/12 (${isi3.label})`),
    TextFormatter.field('Satisfação', getSatisfacaoLabel(data.satisfacaoSono)),
    TextFormatter.field('Interferência', getInterferenciaLabel(data.interferenciaDiurna)),
    TextFormatter.field('Preocupação', getPreocupacaoLabel(data.preocupacaoSono)),
  ]
  if (data.horasDormidas !== undefined) lines.push(TextFormatter.field('Horas/noite', `${data.horasDormidas}h`))
  if (data.acordouNoite !== undefined && data.acordouNoite > 0) lines.push(TextFormatter.field('Despertares', getAcordouNoiteLabel(data.acordouNoite)))
  if (isi3.suggestFullISI) lines.push('⚠️ Triagem positiva. Considerar ISI-7 completo.')
  return TextFormatter.join(lines)
}

export const SonoWidgetDefinition: WidgetDefinition<SonoData> = {
  type: 'sono',
  label: 'Sono',
  description: 'Avaliação do sono baseada no ISI validado',
  icon: 'moon',
  category: 'vital',
  tags: ['sono', 'insônia', 'isi', 'triagem', 'qualidade', 'noite', 'isi-3', 'isi-7'],
  version: 4,
  defaultData: SONO_DEFAULT_DATA,
  schema: SonoDataSchema,
  isComplete: (data) => {
    const hasCore = data.satisfacaoSono !== undefined &&
      data.interferenciaDiurna !== undefined &&
      data.preocupacaoSono !== undefined
    return data.mode === 'completo' ? hasCore && isISI7Complete(data) : hasCore
  },
  isEmpty: isSonoEmpty,
  renderToText: renderSonoToText,
  renderToSummary: (data) => {
    if (data.mode === 'completo') {
      const result = calcularISI7(data)
      return `ISI-7: ${result.score}/28 (${result.label})`
    }
    const result = calcularISI3(data)
    return `ISI-3: ${result.score}/12 (${result.label})`
  },
}
