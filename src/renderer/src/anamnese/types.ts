import type { ComponentType } from 'react'

import type { WidgetDefinition } from '@shared/anamnese'
import type { CatalogoCidItem, CatalogoMedicamentoItem } from '@shared/catalogos-clinicos'

export type MedicacaoCatalogItem = CatalogoMedicamentoItem
export type ProblemaSaudeCatalogItem = CatalogoCidItem

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
