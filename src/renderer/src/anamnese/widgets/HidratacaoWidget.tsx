import { useId } from 'react'

import {
  PERFIL_LABELS,
  type HidratacaoData,
  type HidratacaoPerfil,
} from '@shared/anamnese'

import { Input } from '@/components/ui/input'

import type { WidgetEditorProps } from '../types'
import { WidgetField, numberOrUndefined } from './WidgetFields'

export function HidratacaoWidget({ data, onChange, disabled }: WidgetEditorProps<HidratacaoData>): React.JSX.Element {
  const prefix = useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <WidgetField label="Litros por dia" htmlFor={`${prefix}-litros`}>
        <Input
          id={`${prefix}-litros`}
          type="number"
          min={0}
          max={15}
          step={0.1}
          value={data.litrosDia}
          disabled={disabled}
          onChange={(event) => onChange({ ...data, litrosDia: Number(event.target.value) })}
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
        <Input
          id={`${prefix}-peso`}
          type="number"
          min={20}
          max={300}
          step={0.1}
          value={data.pesoLocal ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ ...data, pesoLocal: numberOrUndefined(event.target.value) })}
        />
      </WidgetField>
      <WidgetField label="Máximo da escala (L)" htmlFor={`${prefix}-max`}>
        <Input
          id={`${prefix}-max`}
          type="number"
          min={3}
          max={15}
          value={data.sliderMax}
          disabled={disabled}
          onChange={(event) => onChange({ ...data, sliderMax: Number(event.target.value) })}
        />
      </WidgetField>
    </div>
  )
}
