import type { ComponentType } from 'react'

import {
  WIDGET_REGISTRY,
  type AnyWidgetDefinition,
  type WidgetType,
} from '@shared/anamnese'

import type { WidgetEditorProps } from './types'
import { AdesaoWidget } from './widgets/AdesaoWidget'
import { BristolWidget } from './widgets/BristolWidget'
import { HidratacaoWidget } from './widgets/HidratacaoWidget'
import { MedicacoesWidget } from './widgets/MedicacoesWidget'
import { ObservacoesGeraisWidget } from './widgets/ObservacoesGeraisWidget'
import { ProblemasSaudeWidget } from './widgets/ProblemasSaudeWidget'
import { RotinaAlimentarWidget } from './widgets/RotinaAlimentarWidget'
import { SonoWidget } from './widgets/SonoWidget'

export interface WidgetUIEntry {
  definition: AnyWidgetDefinition
  Component: ComponentType<WidgetEditorProps<Record<string, unknown>>>
}

function eraseWidgetEditor<TData extends object>(
  Component: ComponentType<WidgetEditorProps<TData>>,
): ComponentType<WidgetEditorProps<Record<string, unknown>>> {
  return Component as unknown as ComponentType<WidgetEditorProps<Record<string, unknown>>>
}

export const WIDGET_UI_REGISTRY = {
  rotina_alimentar: {
    definition: WIDGET_REGISTRY.rotina_alimentar,
    Component: eraseWidgetEditor(RotinaAlimentarWidget),
  },
  hidratacao: {
    definition: WIDGET_REGISTRY.hidratacao,
    Component: eraseWidgetEditor(HidratacaoWidget),
  },
  sono: {
    definition: WIDGET_REGISTRY.sono,
    Component: eraseWidgetEditor(SonoWidget),
  },
  bristol: {
    definition: WIDGET_REGISTRY.bristol,
    Component: eraseWidgetEditor(BristolWidget),
  },
  problemas_saude: {
    definition: WIDGET_REGISTRY.problemas_saude,
    Component: eraseWidgetEditor(ProblemasSaudeWidget),
  },
  medicacoes: {
    definition: WIDGET_REGISTRY.medicacoes,
    Component: eraseWidgetEditor(MedicacoesWidget),
  },
  adesao: {
    definition: WIDGET_REGISTRY.adesao,
    Component: eraseWidgetEditor(AdesaoWidget),
  },
  observacoes_gerais: {
    definition: WIDGET_REGISTRY.observacoes_gerais,
    Component: eraseWidgetEditor(ObservacoesGeraisWidget),
  },
} as const satisfies Record<WidgetType, WidgetUIEntry>

export function getWidgetUI(type: WidgetType): WidgetUIEntry {
  return WIDGET_UI_REGISTRY[type]
}
