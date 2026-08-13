import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const ProblemaSaudeSchema = z.object({
  id: z.string().trim().min(1),
  nome: z.string().trim().min(1),
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

function getValidProblemas(data: ProblemasSaudeData): ProblemaSaude[] {
  return data.problemas.filter((problema) => problema.id.trim() && problema.nome.trim())
}

export function renderProblemasSaudeToText(data: ProblemasSaudeData): string {
  const problemas = getValidProblemas(data)
  if (!problemas.length && !data.observacao?.trim()) return ''

  const lines: Array<string | null> = [TextFormatter.sectionTitle('Problemas de Saúde')]
  if (problemas.length > 0) {
    for (const problema of problemas) {
      let mainLine = buildProblemaLabel(problema.nome.trim(), problema.codigo)
      if (problema.desde) mainLine += ` (desde ${problema.desde})`
      lines.push(TextFormatter.listItem(mainLine))
      if (problema.controlado === true) lines.push(TextFormatter.continuation('Controlado'))
      if (problema.controlado === false) lines.push(TextFormatter.continuation('Não controlado'))
    }
  }

  if (data.observacao?.trim()) lines.push(TextFormatter.field('Obs', data.observacao.trim()))
  return TextFormatter.join(lines)
}

export function gerarResumoProblemas(data: ProblemasSaudeData): string | null {
  const problemas = getValidProblemas(data)
  if (!problemas.length) return null
  if (problemas.length === 1) {
    return buildProblemaLabel(problemas[0].nome.trim(), problemas[0].codigo)
  }
  return `${problemas.length} problemas`
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
  isComplete: (data) => getValidProblemas(data).length > 0 || (data.observacao?.trim().length ?? 0) > 0,
  isEmpty: (data) => getValidProblemas(data).length === 0 && !data.observacao?.trim(),
  renderToText: renderProblemasSaudeToText,
  renderToSummary: gerarResumoProblemas,
}
