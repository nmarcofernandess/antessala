import type { ComponentType } from 'react'

import type { WidgetDefinition } from '@shared/anamnese'

export interface MedicacaoCatalogItem {
  id?: string | number
  nome: string
  classeTerapeutica?: string
}

export interface ProblemaSaudeCatalogItem {
  id?: string | number
  codigo: string
  nome: string
  categoria?: string
}

export interface WidgetCatalogs {
  medicacoes?: readonly MedicacaoCatalogItem[]
  problemasSaude?: readonly ProblemaSaudeCatalogItem[]
}

export interface WidgetEditorProps<TData> {
  data: TData
  onChange: (data: TData) => void
  disabled?: boolean
  catalogs?: WidgetCatalogs
}

export interface WidgetUIDefinition<TData> {
  definition: WidgetDefinition<TData>
  Component: ComponentType<WidgetEditorProps<TData>>
}
