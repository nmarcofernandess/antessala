import { useId } from 'react'

import {
  BRISTOL_DESCRIPTIONS,
  BRISTOL_FREQUENCIA_OPTIONS,
  INTENSIDADE_LABELS,
  SINTOMA_CONFIG,
  SINTOMA_KEYS,
  type BristolData,
  type BristolFrequencia,
  type BristolTipo,
  type SintomaIntensidade,
  type SintomaKey,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

import type { WidgetEditorProps } from '../types'
import { WidgetField } from './WidgetFields'

export function BristolWidget({ data, onChange, disabled }: WidgetEditorProps<BristolData>): React.JSX.Element {
  const prefix = useId()

  const updateSintoma = (key: SintomaKey, patch: { ativo?: boolean; intensidade?: SintomaIntensidade }): void => {
    const current = data.sintomas?.[key] ?? { ativo: false, intensidade: 0 as const }
    onChange({
      ...data,
      sintomas: {
        ...data.sintomas,
        [key]: { ...current, ...patch },
      },
    })
  }

  return (
    <div className="space-y-5">
      <WidgetField label="Tipo na escala de Bristol" hint={BRISTOL_DESCRIPTIONS[data.tipo]}>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5, 6, 7] as BristolTipo[]).map((tipo) => (
            <Button
              key={tipo}
              type="button"
              size="sm"
              variant={data.tipo === tipo ? 'default' : 'outline'}
              aria-label={`Bristol tipo ${tipo}`}
              aria-pressed={data.tipo === tipo}
              disabled={disabled}
              onClick={() => onChange({ ...data, tipo })}
            >
              {tipo}
            </Button>
          ))}
        </div>
      </WidgetField>

      <WidgetField label="Frequência evacuatória" htmlFor={`${prefix}-frequencia`}>
        <select
          id={`${prefix}-frequencia`}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={data.frequencia ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({
            ...data,
            frequencia: (event.target.value || undefined) as BristolFrequencia | undefined,
          })}
        >
          <option value="">Não informado</option>
          {BRISTOL_FREQUENCIA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </WidgetField>

      <div className="space-y-3">
        <p className="text-sm font-medium">Sintomas gastrointestinais</p>
        {SINTOMA_KEYS.map((key) => {
          const sintoma = data.sintomas?.[key]
          return (
            <div key={key} className="rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={sintoma?.ativo ?? false}
                  disabled={disabled}
                  onCheckedChange={(checked) => updateSintoma(key, { ativo: checked === true })}
                />
                {SINTOMA_CONFIG[key].label}
              </label>
              {sintoma?.ativo ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {([0, 1, 2, 3] as SintomaIntensidade[]).map((intensidade) => (
                    <Button
                      key={intensidade}
                      type="button"
                      size="sm"
                      variant={sintoma.intensidade === intensidade ? 'secondary' : 'outline'}
                      disabled={disabled}
                      onClick={() => updateSintoma(key, { intensidade })}
                    >
                      {INTENSIDADE_LABELS[intensidade]}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
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
