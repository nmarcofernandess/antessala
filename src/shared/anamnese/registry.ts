import type { WidgetCategory, WidgetDefinition, WidgetType } from './types'
import { AdesaoWidgetDefinition, type AdesaoData } from './widgets/adesao'
import { BristolWidgetDefinition, type BristolData } from './widgets/bristol'
import { HidratacaoWidgetDefinition, type HidratacaoData } from './widgets/hidratacao'
import { MedicacoesWidgetDefinition, type MedicacoesData } from './widgets/medicacoes'
import {
  ObservacoesGeraisWidgetDefinition,
  type ObservacoesGeraisData,
} from './widgets/observacoes-gerais'
import {
  ProblemasSaudeWidgetDefinition,
  type ProblemasSaudeData,
} from './widgets/problemas-saude'
import {
  RotinaAlimentarWidgetDefinition,
  type RotinaAlimentarData,
} from './widgets/rotina-alimentar'
import { SonoWidgetDefinition, type SonoData } from './widgets/sono'

export interface WidgetDataMap {
  rotina_alimentar: RotinaAlimentarData
  hidratacao: HidratacaoData
  sono: SonoData
  bristol: BristolData
  problemas_saude: ProblemasSaudeData
  medicacoes: MedicacoesData
  adesao: AdesaoData
  observacoes_gerais: ObservacoesGeraisData
}

export const WIDGET_REGISTRY = {
  rotina_alimentar: RotinaAlimentarWidgetDefinition,
  hidratacao: HidratacaoWidgetDefinition,
  sono: SonoWidgetDefinition,
  bristol: BristolWidgetDefinition,
  problemas_saude: ProblemasSaudeWidgetDefinition,
  medicacoes: MedicacoesWidgetDefinition,
  adesao: AdesaoWidgetDefinition,
  observacoes_gerais: ObservacoesGeraisWidgetDefinition,
} as const satisfies { [K in WidgetType]: WidgetDefinition<WidgetDataMap[K]> }

export type WidgetRegistry = typeof WIDGET_REGISTRY
export type AnyWidgetDefinition = WidgetRegistry[keyof WidgetRegistry]

export const WIDGET_CATEGORIES: Record<WidgetCategory, { label: string; icon: string }> = {
  rotina: { label: 'Rotina', icon: '🍽️' },
  vital: { label: 'Avaliação', icon: '📊' },
  saude: { label: 'Saúde', icon: '💊' },
  acompanhamento: { label: 'Acompanhamento', icon: '📈' },
  texto: { label: 'Texto', icon: '📝' },
}

export function isValidWidgetType(type: string): type is WidgetType {
  return Object.hasOwn(WIDGET_REGISTRY, type)
}

export function getWidgetDefinition<T extends WidgetType>(type: T): WidgetRegistry[T]
export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined
export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  if (!isValidWidgetType(type)) return undefined
  return WIDGET_REGISTRY[type]
}

export function getAvailableWidgetTypes(): WidgetType[] {
  return Object.keys(WIDGET_REGISTRY) as WidgetType[]
}

export function getWidgetDefaultData<T extends WidgetType>(type: T): WidgetDataMap[T] {
  return structuredClone(WIDGET_REGISTRY[type].defaultData) as WidgetDataMap[T]
}

export function getWidgetsByCategory(): Record<WidgetCategory, AnyWidgetDefinition[]> {
  const categories: Record<WidgetCategory, AnyWidgetDefinition[]> = {
    rotina: [],
    vital: [],
    saude: [],
    acompanhamento: [],
    texto: [],
  }

  for (const definition of Object.values(WIDGET_REGISTRY)) {
    categories[definition.category].push(definition)
  }
  return categories
}

export function renderWidgetToText<T extends WidgetType>(type: T, data: WidgetDataMap[T]): string {
  const definition = WIDGET_REGISTRY[type] as unknown as WidgetDefinition<WidgetDataMap[T]>
  return definition.renderToText(data)
}
