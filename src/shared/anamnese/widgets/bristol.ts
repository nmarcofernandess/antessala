import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const BristolTipoSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal(5), z.literal(6), z.literal(7),
])
export const BristolFrequenciaSchema = z.enum(['diaria', 'dias_alternados', 'irregular'])
export const SintomaIntensidadeSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
])
export const SintomaSchema = z.object({
  ativo: z.boolean().default(false),
  intensidade: SintomaIntensidadeSchema.default(0),
})
export const SintomasGISchema = z.object({
  inchaco: SintomaSchema.optional(),
  gases: SintomaSchema.optional(),
  dorAbdominal: SintomaSchema.optional(),
})
export const BristolDataSchema = z.object({
  tipo: BristolTipoSchema.default(4),
  frequencia: BristolFrequenciaSchema.optional(),
  observacao: z.string().optional(),
  sintomas: SintomasGISchema.optional(),
})

export type BristolData = z.infer<typeof BristolDataSchema>
export type BristolTipo = z.infer<typeof BristolTipoSchema>
export type BristolFrequencia = z.infer<typeof BristolFrequenciaSchema>
export type SintomaIntensidade = z.infer<typeof SintomaIntensidadeSchema>
export type Sintoma = z.infer<typeof SintomaSchema>
export type SintomaKey = 'inchaco' | 'gases' | 'dorAbdominal'

export const BRISTOL_DEFAULT_DATA: BristolData = { tipo: 4 }

export const BRISTOL_DESCRIPTIONS: Record<number, string> = {
  1: 'Caroços duros separados, como nozes (difícil de passar)',
  2: 'Em forma de salsicha, mas grumosa',
  3: 'Em forma de salsicha, mas com rachaduras na superfície',
  4: 'Em forma de salsicha ou cobra, lisa e macia',
  5: 'Pedaços moles com bordas bem definidas (fácil de passar)',
  6: 'Pedaços fofos com bordas irregulares, pastoso',
  7: 'Líquido, sem pedaços sólidos',
}

export const BRISTOL_STATUS: Record<number, 'constipation' | 'normal' | 'diarrhea'> = {
  1: 'constipation', 2: 'constipation', 3: 'normal', 4: 'normal',
  5: 'normal', 6: 'diarrhea', 7: 'diarrhea',
}

export const BRISTOL_FREQUENCIA_OPTIONS = [
  { value: 'diaria' as const, label: 'Diária' },
  { value: 'dias_alternados' as const, label: 'Dias alternados' },
  { value: 'irregular' as const, label: 'Irregular' },
]

export const SINTOMA_CONFIG: Record<SintomaKey, { label: string }> = {
  inchaco: { label: 'Inchaço' },
  gases: { label: 'Gases' },
  dorAbdominal: { label: 'Dor Abdominal' },
}
export const SINTOMA_KEYS: readonly SintomaKey[] = ['inchaco', 'gases', 'dorAbdominal']
export const INTENSIDADE_LABELS: Record<SintomaIntensidade, string> = {
  0: 'Ausente', 1: 'Leve', 2: 'Moderado', 3: 'Intenso',
}

export const GI_SCORE_CONFIG = {
  max: 12,
  bristolPenalty: 3,
  ranges: {
    normal: { min: 0, max: 3, label: 'Normal' },
    atencao: { min: 4, max: 6, label: 'Atenção' },
    moderado: { min: 7, max: 9, label: 'Moderado' },
    severo: { min: 10, max: 12, label: 'Severo' },
  },
} as const

export function getBristolStatus(tipo: number): 'constipation' | 'normal' | 'diarrhea' {
  return BRISTOL_STATUS[tipo] ?? 'normal'
}

export function getFrequenciaLabel(value: BristolFrequencia): string {
  return BRISTOL_FREQUENCIA_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function hasSintomasAtivos(data: BristolData): boolean {
  return SINTOMA_KEYS.some((key) => data.sintomas?.[key]?.ativo)
}

export function calculateGIScore(data: BristolData): number | null {
  if (!data.sintomas) return null

  let score = getBristolStatus(data.tipo) === 'normal' ? 0 : GI_SCORE_CONFIG.bristolPenalty
  for (const key of SINTOMA_KEYS) {
    const sintoma = data.sintomas[key]
    if (sintoma?.ativo && sintoma.intensidade > 0) score += sintoma.intensidade
  }
  return Math.min(score, GI_SCORE_CONFIG.max)
}

export function getGIScoreInfo(score: number): { label: string } {
  if (score <= GI_SCORE_CONFIG.ranges.normal.max) return GI_SCORE_CONFIG.ranges.normal
  if (score <= GI_SCORE_CONFIG.ranges.atencao.max) return GI_SCORE_CONFIG.ranges.atencao
  if (score <= GI_SCORE_CONFIG.ranges.moderado.max) return GI_SCORE_CONFIG.ranges.moderado
  return GI_SCORE_CONFIG.ranges.severo
}

export function renderBristolToText(data: BristolData): string {
  const empty =
    data.tipo === BRISTOL_DEFAULT_DATA.tipo &&
    data.frequencia === undefined &&
    data.observacao === undefined &&
    !hasSintomasAtivos(data)
  if (empty) return ''

  const status = getBristolStatus(data.tipo)
  const statusLabel = status === 'normal' ? 'normal' : status === 'constipation' ? 'constipação' : 'diarreia'
  const lines: Array<string | null> = [
    TextFormatter.sectionTitle('Hábito Intestinal'),
    TextFormatter.field('Bristol', `Tipo ${data.tipo} (${statusLabel})`),
    TextFormatter.continuation(BRISTOL_DESCRIPTIONS[data.tipo]),
  ]

  if (data.frequencia) lines.push(TextFormatter.field('Frequência', getFrequenciaLabel(data.frequencia)))
  if (hasSintomasAtivos(data)) {
    lines.push(TextFormatter.listItem('Sintomas GI:'))
    for (const key of SINTOMA_KEYS.filter((item) => data.sintomas?.[item]?.ativo)) {
      const sintoma = data.sintomas?.[key]
      if (sintoma) {
        lines.push(TextFormatter.subItem(`${SINTOMA_CONFIG[key].label}: ${INTENSIDADE_LABELS[sintoma.intensidade]}`))
      }
    }
  }

  const giScore = calculateGIScore(data)
  if (giScore !== null) lines.push(TextFormatter.field('GI Score', `${giScore}/12 (${getGIScoreInfo(giScore).label})`))
  if (data.observacao) lines.push(TextFormatter.field('Obs', data.observacao))
  return TextFormatter.join(lines)
}

export const BristolWidgetDefinition: WidgetDefinition<BristolData> = {
  type: 'bristol',
  label: 'Hábito Intestinal',
  description: 'Bristol, frequência, sintomas GI e GI Score',
  icon: 'activity',
  category: 'vital',
  tags: ['intestino', 'fezes', 'evacuação', 'constipação', 'diarreia', 'bristol', 'sintomas'],
  version: 2,
  defaultData: BRISTOL_DEFAULT_DATA,
  schema: BristolDataSchema,
  isComplete: (data) => data.tipo >= 1 && data.tipo <= 7,
  isEmpty: (data) =>
    data.tipo === BRISTOL_DEFAULT_DATA.tipo &&
    data.frequencia === undefined &&
    data.observacao === undefined &&
    !hasSintomasAtivos(data),
  renderToText: renderBristolToText,
  renderToSummary: (data) => {
    const status = getBristolStatus(data.tipo)
    let tipo = `Tipo ${data.tipo}`
    if (status !== 'normal') tipo += status === 'constipation' ? ' (constipação)' : ' (diarreia)'
    const giScore = calculateGIScore(data)
    if (giScore !== null) return `${tipo} • GI ${giScore}/12`
    if (data.frequencia) return `${tipo} • ${getFrequenciaLabel(data.frequencia)}`
    return tipo
  },
}
