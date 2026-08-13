import { createAnamneseId } from './id'
import { createWidgetBlock } from './serialization'
import type { AnamneseContent, AnamneseTemplate, BlocoWidget } from './types'

/**
 * Catálogo deliberadamente vazio. A seleção clínica chega de
 * hack/specs/02-quais-widgets/ e não é decidida por esta preparação.
 */
export const ACTIVE_ANAMNESE_TEMPLATES: readonly AnamneseTemplate[] = []

/** Referência histórica do DietFlow; não participa do catálogo ativo. */
export const LEGACY_DIETFLOW_BASIC_TEMPLATE: AnamneseTemplate = {
  id: 'dietflow-basica-legado',
  label: 'Anamnese Básica (legado DietFlow)',
  description: 'Os oito widgets herdados do formulário guiado do DietFlow',
  icon: '📋',
  widgetTypes: [
    'rotina_alimentar',
    'hidratacao',
    'sono',
    'bristol',
    'problemas_saude',
    'medicacoes',
    'adesao',
    'observacoes_gerais',
  ],
}

export function createBlocksFromTemplate(
  template: AnamneseTemplate,
  idFactory: () => string = createAnamneseId,
): BlocoWidget[] {
  return template.widgetTypes.map((widgetType) => createWidgetBlock(widgetType, idFactory()))
}

export function createLegacyDietFlowBasicAnamnese(
  idFactory: () => string = createAnamneseId,
): AnamneseContent {
  return {
    _v: 2,
    blocos: createBlocksFromTemplate(LEGACY_DIETFLOW_BASIC_TEMPLATE, idFactory),
  }
}
