import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const HidratacaoPerfilSchema = z.enum(['sedentario', 'ativo', 'atleta'])
export const HidratacaoDataSchema = z.object({
  litrosDia: z.number().min(0).max(15).default(2),
  perfil: HidratacaoPerfilSchema.optional(),
  pesoLocal: z.number().min(20).max(300).optional(),
  sliderMax: z.number().min(3).max(15).default(5),
})

export type HidratacaoData = z.infer<typeof HidratacaoDataSchema>
export type HidratacaoPerfil = z.infer<typeof HidratacaoPerfilSchema>

export const HIDRATACAO_DEFAULT_DATA: HidratacaoData = {
  litrosDia: 2,
  perfil: undefined,
  pesoLocal: undefined,
  sliderMax: 5,
}

export const PERFIL_RANGES: Record<HidratacaoPerfil, { min: number; max: number }> = {
  sedentario: { min: 30, max: 35 },
  ativo: { min: 35, max: 40 },
  atleta: { min: 40, max: 50 },
}

export const PERFIL_LABELS: Record<HidratacaoPerfil, string> = {
  sedentario: 'Sedentário',
  ativo: 'Ativo',
  atleta: 'Atleta',
}

export function calculateHidratacaoMeta(
  peso: number,
  perfil: HidratacaoPerfil = 'sedentario',
): { min: number; max: number } {
  const range = PERFIL_RANGES[perfil]
  return {
    min: (peso * range.min) / 1000,
    max: (peso * range.max) / 1000,
  }
}

export function renderHidratacaoToText(data: HidratacaoData): string {
  if (data.litrosDia === 0) return ''

  const copos = Math.round(data.litrosDia / 0.25)
  const lines: Array<string | null> = [
    TextFormatter.sectionTitle('Hidratação'),
    TextFormatter.field('Consumo', `${data.litrosDia.toFixed(1)}L/dia (${copos} copos)`),
  ]

  if (data.perfil) lines.push(TextFormatter.field('Perfil', PERFIL_LABELS[data.perfil]))
  if (data.pesoLocal) {
    lines.push(TextFormatter.field('ml/kg', `${((data.litrosDia * 1000) / data.pesoLocal).toFixed(0)}ml/kg`))
  }
  if (data.pesoLocal && data.perfil) {
    const faixa = calculateHidratacaoMeta(data.pesoLocal, data.perfil)
    lines.push(TextFormatter.field('Faixa adequada', `${faixa.min.toFixed(1)}-${faixa.max.toFixed(1)}L`))
  }
  return TextFormatter.join(lines)
}

export const HidratacaoWidgetDefinition: WidgetDefinition<HidratacaoData> = {
  type: 'hidratacao',
  label: 'Hidratação',
  description: 'Consumo de água em litros por dia',
  icon: 'droplets',
  category: 'vital',
  tags: ['água', 'líquido', 'hidratação', 'consumo', 'ml', 'litros'],
  version: 1,
  defaultData: HIDRATACAO_DEFAULT_DATA,
  schema: HidratacaoDataSchema,
  isComplete: (data) => data.litrosDia > 0,
  isEmpty: (data) => data.litrosDia === 0,
  renderToText: renderHidratacaoToText,
  renderToSummary: (data) => {
    if (data.litrosDia === 0) return null
    return `${data.litrosDia.toFixed(1)}L/dia (${Math.round(data.litrosDia / 0.25)} copos)`
  },
}
