import { z } from 'zod'

import { createAnamneseId } from '../id'
import { TextFormatter } from '../text-formatter'
import type { WidgetDefinition } from '../types'

export const RegistroTipoSchema = z.enum(['alimento', 'exercicio', 'remedio', 'suplemento'])
export const RegistroDiaSchema = z.object({
  id: z.string(),
  tipo: RegistroTipoSchema.default('alimento'),
  titulo: z.string(),
  horario: z.string().optional(),
  descricao: z.string(),
})
export const RotinaAlimentarDataSchema = z.object({
  registros: z.array(RegistroDiaSchema).default([]),
})

export type RegistroTipo = z.infer<typeof RegistroTipoSchema>
export type RegistroDia = z.infer<typeof RegistroDiaSchema>
export type RotinaAlimentarData = z.infer<typeof RotinaAlimentarDataSchema>

export const ROTINA_ALIMENTAR_DEFAULT_DATA: RotinaAlimentarData = { registros: [] }

export const REGISTRO_TIPO_CONFIG: Record<RegistroTipo, {
  label: string
  labelPlural: string
  placeholder: string
}> = {
  alimento: { label: 'Refeição', labelPlural: 'Refeições', placeholder: 'O que comeu nesta refeição...' },
  exercicio: { label: 'Exercício', labelPlural: 'Exercícios', placeholder: 'Tipo, duração e intensidade...' },
  remedio: { label: 'Remédio', labelPlural: 'Remédios', placeholder: 'Nome e dose...' },
  suplemento: { label: 'Suplemento', labelPlural: 'Suplementos', placeholder: 'Nome e dose...' },
}

export function migrateRotinaData(data: unknown): RotinaAlimentarData {
  if (!data || typeof data !== 'object') return ROTINA_ALIMENTAR_DEFAULT_DATA

  const object = data as Record<string, unknown>
  if (Array.isArray(object.registros)) return RotinaAlimentarDataSchema.parse(data)
  if (Array.isArray(object.refeicoes)) {
    return {
      registros: (object.refeicoes as Array<Record<string, unknown>>).map((registro) => ({
        id: String(registro.id || createAnamneseId()),
        tipo: 'alimento',
        titulo: String(registro.titulo || ''),
        horario: registro.horario ? String(registro.horario) : undefined,
        descricao: String(registro.descricao || ''),
      })),
    }
  }
  return ROTINA_ALIMENTAR_DEFAULT_DATA
}

export function groupRegistrosByTipo(
  registros: RegistroDia[],
): Record<RegistroTipo, RegistroDia[]> {
  const groups: Record<RegistroTipo, RegistroDia[]> = {
    alimento: [], exercicio: [], remedio: [], suplemento: [],
  }
  for (const registro of registros) groups[registro.tipo || 'alimento'].push(registro)
  return groups
}

export function renderRotinaToText(data: RotinaAlimentarData): string {
  const registros = migrateRotinaData(data).registros.filter(
    (registro) => registro.titulo.trim() || registro.descricao.trim(),
  )
  if (registros.length === 0) return ''

  const lines: Array<string | null> = [TextFormatter.sectionTitle('Rotina do Dia')]
  const groups = groupRegistrosByTipo(registros)
  const tipos: RegistroTipo[] = ['alimento', 'exercicio', 'remedio', 'suplemento']

  for (const tipo of tipos) {
    if (groups[tipo].length === 0) continue
    const config = REGISTRO_TIPO_CONFIG[tipo]
    lines.push(TextFormatter.listItem(`${config.labelPlural}:`))
    for (const registro of groups[tipo]) {
      const titulo = registro.titulo.trim() || config.label
      const horario = registro.horario ? ` (${registro.horario})` : ''
      const descricao = registro.descricao.trim() || '(sem descrição)'
      lines.push(TextFormatter.subItem(`${titulo}${horario}: ${descricao}`))
    }
  }
  return TextFormatter.join(lines)
}

export const RotinaAlimentarWidgetDefinition: WidgetDefinition<RotinaAlimentarData> = {
  type: 'rotina_alimentar',
  label: 'Rotina do Dia',
  description: 'Registra alimentação, exercícios, remédios e suplementos',
  icon: 'calendar-clock',
  category: 'rotina',
  tags: ['refeição', 'alimentação', 'exercício', 'remédio', 'suplemento', 'horário', 'rotina'],
  version: 2,
  defaultData: ROTINA_ALIMENTAR_DEFAULT_DATA,
  schema: RotinaAlimentarDataSchema,
  isComplete: (data) => migrateRotinaData(data).registros.some(
    (registro) => Boolean(registro.titulo.trim() && registro.descricao.trim()),
  ),
  isEmpty: (data) => {
    const registros = migrateRotinaData(data).registros
    return registros.length === 0 || registros.every(
      (registro) => !registro.titulo.trim() && !registro.descricao.trim(),
    )
  },
  renderToText: renderRotinaToText,
  renderToSummary: (data) => {
    const registros = migrateRotinaData(data).registros.filter(
      (registro) => registro.titulo.trim() || registro.descricao.trim(),
    )
    if (registros.length === 0) return null

    const groups = groupRegistrosByTipo(registros)
    const tipos: RegistroTipo[] = ['alimento', 'exercicio', 'remedio', 'suplemento']
    return tipos
      .filter((tipo) => groups[tipo].length > 0)
      .map((tipo) => {
        const count = groups[tipo].length
        const config = REGISTRO_TIPO_CONFIG[tipo]
        return `${count} ${count === 1 ? config.label.toLowerCase() : config.labelPlural.toLowerCase()}`
      })
      .join(', ')
  },
}
