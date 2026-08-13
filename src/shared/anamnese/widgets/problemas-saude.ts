import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const ProblemaSaudeSchema = z.object({
  id: z.string(),
  nome: z.string(),
  codigo: z.string().optional(),
  desde: z.string().optional(),
  controlado: z.boolean().optional(),
})

export const ProblemasSaudeDataSchema = z.object({
  problemas: z.array(ProblemaSaudeSchema).default([]),
  observacao: z.string().optional(),
})

export type ProblemaSaude = z.infer<typeof ProblemaSaudeSchema>
export type ProblemasSaudeData = z.infer<typeof ProblemasSaudeDataSchema>

export const PROBLEMAS_SAUDE_DEFAULT_DATA: ProblemasSaudeData = { problemas: [] }

function buildProblemaLabel(nome: string, codigo?: string): string {
  if (!codigo || nome.toLowerCase().startsWith(codigo.toLowerCase())) return nome
  return `${codigo} - ${nome}`
}

export function renderProblemasSaudeToText(data: ProblemasSaudeData): string {
  if (!data.problemas.length && !data.observacao?.trim()) return ''

  const lines: Array<string | null> = [TextFormatter.sectionTitle('Problemas de Saúde')]
  if (data.problemas.length > 0) {
    for (const problema of data.problemas) {
      let mainLine = buildProblemaLabel(problema.nome, problema.codigo)
      if (problema.desde) mainLine += ` (desde ${problema.desde})`
      lines.push(TextFormatter.listItem(mainLine))
      if (problema.controlado === true) lines.push(TextFormatter.continuation('Controlado'))
      if (problema.controlado === false) lines.push(TextFormatter.continuation('Não controlado'))
    }
  } else {
    lines.push(TextFormatter.listItem('Nenhum problema de saúde registrado'))
  }

  if (data.observacao?.trim()) lines.push(TextFormatter.field('Obs', data.observacao.trim()))
  return TextFormatter.join(lines)
}

export function gerarResumoProblemas(data: ProblemasSaudeData): string | null {
  if (!data.problemas.length) return null
  if (data.problemas.length === 1) {
    return buildProblemaLabel(data.problemas[0].nome, data.problemas[0].codigo)
  }
  return `${data.problemas.length} problemas`
}

export const ProblemasSaudeWidgetDefinition: WidgetDefinition<ProblemasSaudeData> = {
  type: 'problemas_saude',
  label: 'Problemas de Saúde',
  description: 'Registra condições de saúde conhecidas',
  icon: 'heart-pulse',
  category: 'saude',
  tags: ['problemas', 'saúde', 'doenças', 'condições', 'comorbidades', 'cid'],
  version: 2,
  defaultData: PROBLEMAS_SAUDE_DEFAULT_DATA,
  schema: ProblemasSaudeDataSchema,
  isComplete: (data) => data.problemas.length > 0 || (data.observacao?.trim().length ?? 0) > 0,
  isEmpty: (data) => data.problemas.length === 0 && !data.observacao?.trim(),
  renderToText: renderProblemasSaudeToText,
  renderToSummary: gerarResumoProblemas,
}
