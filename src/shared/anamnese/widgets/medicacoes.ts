import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const MedicacaoFrequenciaSchema = z.enum([
  '1x_dia',
  '2x_dia',
  '3x_dia',
  '4x_dia',
  '1x_semana',
  '2x_semana',
  '3x_semana',
  'dias_alternados',
  'uso_continuo',
  'sob_demanda',
])

export const MedicacaoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  dose: z.string().optional(),
  frequencia: MedicacaoFrequenciaSchema.optional(),
  motivo: z.string().optional(),
})

export const MedicacoesDataSchema = z.object({
  medicacoes: z.array(MedicacaoSchema).default([]),
  naoUsaMedicamentos: z.boolean().optional(),
})

export type MedicacaoFrequencia = z.infer<typeof MedicacaoFrequenciaSchema>
export type Medicacao = z.infer<typeof MedicacaoSchema>
export type MedicacoesData = z.infer<typeof MedicacoesDataSchema>

export const MEDICACOES_DEFAULT_DATA: MedicacoesData = { medicacoes: [] }

export const FREQUENCIA_LABELS: Record<MedicacaoFrequencia, string> = {
  '1x_dia': '1x ao dia',
  '2x_dia': '2x ao dia',
  '3x_dia': '3x ao dia',
  '4x_dia': '4x ao dia',
  '1x_semana': '1x por semana',
  '2x_semana': '2x por semana',
  '3x_semana': '3x por semana',
  dias_alternados: 'Dias alternados',
  uso_continuo: 'Uso contínuo',
  sob_demanda: 'Sob demanda',
}

export const MEDICACAO_FREQUENCIA_OPTIONS = Object.entries(FREQUENCIA_LABELS).map(([value, label]) => ({
  value: value as MedicacaoFrequencia,
  label,
}))

export function renderMedicacoesToText(data: MedicacoesData): string {
  if (data.medicacoes.length === 0 && data.naoUsaMedicamentos !== true) return ''

  const lines: Array<string | null> = [TextFormatter.sectionTitle('Medicações')]
  if (data.naoUsaMedicamentos) {
    lines.push(TextFormatter.listItem('Não utiliza medicamentos de uso contínuo'))
    return TextFormatter.join(lines)
  }

  if (data.medicacoes.length > 0) {
    lines.push(TextFormatter.listItem('Medicamentos em uso:'))
    for (const medicacao of data.medicacoes) {
      const parts = [medicacao.nome]
      if (medicacao.dose) parts.push(medicacao.dose)
      if (medicacao.frequencia) parts.push(`(${FREQUENCIA_LABELS[medicacao.frequencia]})`)
      let info = parts.join(' ')
      if (medicacao.motivo) info += ` — ${medicacao.motivo}`
      lines.push(TextFormatter.subItem(info))
    }
  }
  return TextFormatter.join(lines)
}

export function gerarResumoMedicacoes(data: MedicacoesData): string | null {
  if (data.naoUsaMedicamentos) return 'Não usa medicamentos'
  if (data.medicacoes.length === 1) return data.medicacoes[0].nome
  if (data.medicacoes.length > 1) return `${data.medicacoes.length} medicações`
  return null
}

export const MedicacoesWidgetDefinition: WidgetDefinition<MedicacoesData> = {
  type: 'medicacoes',
  label: 'Medicações',
  description: 'Registra medicamentos de uso contínuo',
  icon: 'pill',
  category: 'saude',
  tags: ['medicações', 'remédios', 'medicamentos', 'uso contínuo', 'fármacos'],
  version: 3,
  featureStatus: 'dev',
  defaultData: MEDICACOES_DEFAULT_DATA,
  schema: MedicacoesDataSchema,
  isComplete: (data) => data.medicacoes.length > 0 || data.naoUsaMedicamentos === true,
  isEmpty: (data) => data.medicacoes.length === 0 && data.naoUsaMedicamentos !== true,
  renderToText: renderMedicacoesToText,
  renderToSummary: gerarResumoMedicacoes,
}
