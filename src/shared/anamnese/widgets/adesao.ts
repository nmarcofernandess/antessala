import { z } from 'zod'

import type { WidgetDefinition } from '../types'

export const AdesaoSeguiuSchema = z.enum(['sim', 'mais_ou_menos', 'nao'])

export const AdesaoDataSchema = z.object({
  seguiu: AdesaoSeguiuSchema.default('sim'),
  diferencaCalorica: z.number().optional(),
  diasPeriodo: z.number().default(7),
  observacao: z.string().optional(),
})

export type AdesaoData = z.infer<typeof AdesaoDataSchema>
export type AdesaoSeguiu = z.infer<typeof AdesaoSeguiuSchema>

export const ADESAO_DEFAULT_DATA: AdesaoData = {
  seguiu: 'sim',
  diasPeriodo: 7,
}

export const ADESAO_SEGUIU_LABELS: Record<AdesaoSeguiu, string> = {
  sim: 'Sim',
  mais_ou_menos: 'Parcialmente',
  nao: 'Não',
}

export const PERIODO_OPTIONS = [7, 14, 30] as const
export const KCAL_POR_KG = 7700

export function formatDiferencaCalorica(valor?: number): string | null {
  if (valor === undefined || valor === 0) return null
  return `${valor >= 0 ? '+' : ''}${valor}kcal/dia`
}

export function calcularImpactoPeso(
  diferencaCalorica: number,
  diasPeriodo: number,
): { kcalTotal: number; impactoKg: number; impactoGramas: number; direcao: 'ganho' | 'perda' | 'neutro' } {
  const kcalTotal = diferencaCalorica * diasPeriodo
  const impactoKg = kcalTotal / KCAL_POR_KG

  return {
    kcalTotal,
    impactoKg: Number(impactoKg.toFixed(2)),
    impactoGramas: Math.round(impactoKg * 1000),
    direcao: impactoKg > 0 ? 'ganho' : impactoKg < 0 ? 'perda' : 'neutro',
  }
}

export function formatImpactoPeso(impactoGramas: number): string {
  if (impactoGramas === 0) return 'Sem impacto'

  const abs = Math.abs(impactoGramas)
  const sinal = impactoGramas > 0 ? '+' : '-'
  if (abs >= 1000) return `${sinal}${(abs / 1000).toFixed(1)}kg`
  return `${sinal}${abs}g`
}

export function renderAdesaoToText(data: AdesaoData): string {
  const label = ADESAO_SEGUIU_LABELS[data.seguiu]
  let text = `Adesão à Dieta: ${label}`

  if (data.diferencaCalorica !== undefined && data.diferencaCalorica !== 0) {
    const diasPeriodo = data.diasPeriodo ?? 7
    const impacto = calcularImpactoPeso(data.diferencaCalorica, diasPeriodo)
    text += `. Diferença calórica: ${formatDiferencaCalorica(data.diferencaCalorica)}`
    text += ` (impacto estimado: ${formatImpactoPeso(impacto.impactoGramas)} em ${diasPeriodo} dias)`
  }

  if (data.observacao) text += `. ${data.observacao}`
  return text
}

export const AdesaoWidgetDefinition: WidgetDefinition<AdesaoData> = {
  type: 'adesao',
  label: 'Adesão à Dieta',
  description: 'Registra se a pessoa seguiu o plano alimentar',
  icon: 'clipboard-check',
  category: 'acompanhamento',
  tags: ['adesão', 'dieta', 'seguiu', 'plano', 'alimentar', 'compliance'],
  version: 1,
  defaultData: ADESAO_DEFAULT_DATA,
  schema: AdesaoDataSchema,
  isComplete: (data) => ['sim', 'mais_ou_menos', 'nao'].includes(data.seguiu),
  isEmpty: (data) =>
    data.seguiu === 'sim' &&
    data.diferencaCalorica === undefined &&
    (data.observacao === undefined || data.observacao === ''),
  renderToText: renderAdesaoToText,
  renderToSummary: (data) => {
    const label = ADESAO_SEGUIU_LABELS[data.seguiu]
    if (data.diferencaCalorica === undefined || data.diferencaCalorica === 0) return label

    const formatted = formatDiferencaCalorica(data.diferencaCalorica)
    const impacto = calcularImpactoPeso(data.diferencaCalorica, data.diasPeriodo ?? 7)
    return `${label} (${formatted} → ${formatImpactoPeso(impacto.impactoGramas)})`
  },
}
