import { z } from 'zod'

import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const ObservacoesGeraisDataSchema = z.object({
  texto: z.string().default(''),
})

export type ObservacoesGeraisData = z.infer<typeof ObservacoesGeraisDataSchema>
export const OBSERVACOES_DEFAULT_DATA: ObservacoesGeraisData = { texto: '' }

export function hasContent(texto: string): boolean {
  return texto.trim().length > 0
}

export function truncateForSummary(texto: string, maxLength = 60): string | null {
  const trimmed = texto.trim()
  if (!trimmed) return null
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 3)}...`
}

export function renderObservacoesToText(data: ObservacoesGeraisData): string {
  if (!hasContent(data.texto)) return ''
  return TextFormatter.join([
    TextFormatter.sectionTitle('Observações'),
    TextFormatter.textBlock(data.texto),
  ])
}

export const ObservacoesGeraisWidgetDefinition: WidgetDefinition<ObservacoesGeraisData> = {
  type: 'observacoes_gerais',
  label: 'Bloco de Texto',
  description: 'Texto livre para anotações',
  icon: 'type',
  category: 'texto',
  tags: ['texto', 'observações', 'notas', 'anotações', 'atendimento', 'queixas'],
  version: 1,
  defaultData: OBSERVACOES_DEFAULT_DATA,
  schema: ObservacoesGeraisDataSchema,
  isComplete: (data) => hasContent(data.texto),
  isEmpty: (data) => !hasContent(data.texto),
  renderToText: renderObservacoesToText,
  renderToSummary: (data) => truncateForSummary(data.texto, 60),
}
