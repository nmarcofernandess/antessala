import { useId } from 'react'

import {
  PERFIL_LABELS,
  type HidratacaoData,
  type HidratacaoPerfil,
} from '@shared/anamnese'

import type { WidgetEditorProps } from '../types'
import { BoundedNumberInput, WidgetField } from './WidgetFields'

export function HidratacaoWidget({ data, onChange, disabled }: WidgetEditorProps<HidratacaoData>): React.JSX.Element {
  const prefix = useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <WidgetField label="Litros por dia" htmlFor={`${prefix}-litros`}>
        <BoundedNumberInput
          id={`${prefix}-litros`}
          min={0}
          max={15}
          step={0.1}
          value={data.litrosDia}
          disabled={disabled}
          onCommit={(value) => {
            if (value !== undefined) onChange({ ...data, litrosDia: value })
          }}
        />
      </WidgetField>
      <WidgetField label="Perfil" htmlFor={`${prefix}-perfil`}>
        <select
          id={`${prefix}-perfil`}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={data.perfil ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({
            ...data,
            perfil: (event.target.value || undefined) as HidratacaoPerfil | undefined,
          })}
        >
          <option value="">Não informado</option>
          {(Object.keys(PERFIL_LABELS) as HidratacaoPerfil[]).map((perfil) => (
            <option key={perfil} value={perfil}>{PERFIL_LABELS[perfil]}</option>
          ))}
        </select>
      </WidgetField>
      <WidgetField label="Peso para cálculo local (kg)" htmlFor={`${prefix}-peso`}>
        <BoundedNumberInput
          id={`${prefix}-peso`}
          min={20}
          max={300}
          step={0.1}
          value={data.pesoLocal}
          optional
          disabled={disabled}
          onCommit={(value) => onChange({ ...data, pesoLocal: value })}
        />
      </WidgetField>
      <WidgetField label="Máximo da escala (L)" htmlFor={`${prefix}-max`}>
        <BoundedNumberInput
          id={`${prefix}-max`}
          min={3}
          max={15}
          value={data.sliderMax}
          disabled={disabled}
          onCommit={(value) => {
            if (value !== undefined) onChange({ ...data, sliderMax: value })
          }}
        />
      </WidgetField>
    </div>
  )
}
