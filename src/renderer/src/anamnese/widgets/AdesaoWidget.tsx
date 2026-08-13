import { useId } from 'react'

import {
  ADESAO_SEGUIU_LABELS,
  PERIODO_OPTIONS,
  type AdesaoData,
  type AdesaoSeguiu,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { WidgetEditorProps } from '../types'
import { WidgetField, numberOrUndefined } from './WidgetFields'

export function AdesaoWidget({ data, onChange, disabled }: WidgetEditorProps<AdesaoData>): React.JSX.Element {
  const prefix = useId()

  return (
    <div className="space-y-4">
      <WidgetField label="Seguiu a dieta?">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ADESAO_SEGUIU_LABELS) as AdesaoSeguiu[]).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={data.seguiu === value ? 'default' : 'outline'}
              aria-pressed={data.seguiu === value}
              disabled={disabled}
              onClick={() => onChange({ ...data, seguiu: value })}
            >
              {ADESAO_SEGUIU_LABELS[value]}
            </Button>
          ))}
        </div>
      </WidgetField>

      <div className="grid gap-4 sm:grid-cols-2">
        <WidgetField label="Diferença calórica estimada" htmlFor={`${prefix}-calorias`} hint="Positivo significa consumo acima do plano.">
          <Input
            id={`${prefix}-calorias`}
            type="number"
            value={data.diferencaCalorica ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...data, diferencaCalorica: numberOrUndefined(event.target.value) })}
          />
        </WidgetField>
        <WidgetField label="Período" htmlFor={`${prefix}-periodo`}>
          <select
            id={`${prefix}-periodo`}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={data.diasPeriodo ?? 7}
            disabled={disabled}
            onChange={(event) => onChange({ ...data, diasPeriodo: Number(event.target.value) })}
          >
            {PERIODO_OPTIONS.map((dias) => <option key={dias} value={dias}>{dias} dias</option>)}
          </select>
        </WidgetField>
      </div>

      <WidgetField label="Observação" htmlFor={`${prefix}-observacao`}>
        <Textarea
          id={`${prefix}-observacao`}
          value={data.observacao ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ ...data, observacao: event.target.value || undefined })}
        />
      </WidgetField>
    </div>
  )
}
