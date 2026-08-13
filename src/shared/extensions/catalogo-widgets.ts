export const CATALOGO_WIDGETS_SPEC_PATH = 'hack/specs/02-quais-widgets/' as const

/**
 * Ponto de encaixe para a seleção de widgets e templates da triagem.
 *
 * Deliberadamente vazio nesta etapa. A decisão clínica pertence a
 * `hack/specs/02-quais-widgets/` e deve ser aplicada aqui quando chegar.
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
