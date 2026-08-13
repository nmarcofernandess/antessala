import type { z } from 'zod'

export const WIDGET_TYPES = [
  'rotina_alimentar',
  'hidratacao',
  'sono',
  'bristol',
  'problemas_saude',
  'medicacoes',
  'adesao',
  'observacoes_gerais',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

export type WidgetCategory =
  | 'rotina'
  | 'vital'
  | 'saude'
  | 'acompanhamento'
  | 'texto'

export type FeatureStatus = 'dev' | 'beta' | 'stable'

/** Metadados e regras puras de um widget, sem dependência de React. */
export interface WidgetDefinition<TData> {
  type: WidgetType
  label: string
  description: string
  icon: string
  category: WidgetCategory
  tags: readonly string[]
  version: number
  featureStatus?: FeatureStatus
  defaultData: TData
  schema: z.ZodType<TData>
  isComplete: (data: TData) => boolean
  isEmpty: (data: TData) => boolean
  renderToText: (data: TData) => string
  renderToSummary: (data: TData) => string | null
}

export type BlocoType = 'widget' | 'snapshot' | 'resultado_protocolo'

export interface BlocoWidget {
  /** Versão do schema específico do widget. */
  _v?: number
  id: string
  type: 'widget'
  widgetType: WidgetType
  data: Record<string, unknown>
  convertidoParaTexto: boolean
  textoConvertido?: string
}

export interface SnapshotOverviewData {
  dataCaptura: string
  antropometria?: {
    peso: number
    altura: number
    imc: number
    percentualGordura?: number
  }
  estrategia?: {
    tipo: string
    calorias: number
    dieta?: string
  }
  objetivo?: {
    descricao: string
    meta?: number
    progresso?: number
  }
  protocolos?: Array<{
    protocolo: string
    score: number
    interpretacao: string
  }>
}

export interface BlocoSnapshot {
  _v?: number
  id: string
  type: 'snapshot'
  dataCaptura: string
  dados: SnapshotOverviewData
}

export interface BlocoResultado {
  _v?: number
  id: string
  type: 'resultado_protocolo'
  protocoloTipo: string
  protocoloId: string
  scoreCapturado: number
  subscoresCapturados?: Record<string, number>
  dataCaptura: string
}

export type Bloco = BlocoWidget | BlocoSnapshot | BlocoResultado

/** Envelope canônico persistido na coluna JSONB do registro. */
export interface AnamneseContent {
  _v: 2
  blocos: Bloco[]
}

export interface AnamneseTemplate {
  id: string
  label: string
  description: string
  icon: string
  widgetTypes: readonly WidgetType[]
}
