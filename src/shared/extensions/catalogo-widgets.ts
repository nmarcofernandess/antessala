export const CATALOGO_WIDGETS_SPEC_PATH =
  'hack/minispecs/001-caso-triagem-classificacao/' as const

/**
 * Ponto de encaixe para a seleção de widgets e templates da triagem.
 *
 * A MiniSpec 001 preenche este catálogo com os widgets usados na demonstração.
 */
export interface CatalogoWidgetsEspecificos<
  TWidgetType extends string = never,
  TTemplate = never,
> {
  readonly widgetTypes: readonly TWidgetType[]
  readonly templates: readonly TTemplate[]
}

export const CATALOGO_WIDGETS_ESPECIFICOS: CatalogoWidgetsEspecificos = Object.freeze({
  widgetTypes: Object.freeze([]),
  templates: Object.freeze([]),
})
