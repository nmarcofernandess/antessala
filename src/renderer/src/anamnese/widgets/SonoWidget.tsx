import { useId } from 'react'

import {
  ACORDOU_NOITE_OPTIONS,
  DESPERTAR_CEDO_OPTIONS,
  DIFICULDADE_INICIAR_OPTIONS,
  DIFICULDADE_MANTER_OPTIONS,
  INTERFERENCIA_DIURNA_OPTIONS,
  PERCEPTIVEL_OUTROS_OPTIONS,
  PREOCUPACAO_SONO_OPTIONS,
  SATISFACAO_SONO_OPTIONS,
  calcularISI3,
  calcularISI7,
  type AcordouNoite,
  type ISILikert,
  type SonoData,
} from '@shared/anamnese'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { WidgetEditorProps } from '../types'
import { BoundedNumberInput, WidgetField } from './WidgetFields'

interface LikertFieldProps {
  label: string
  value: ISILikert | undefined
  options: ReadonlyArray<{ value: ISILikert; label: string }>
  disabled?: boolean
  onChange: (value: ISILikert) => void
}

function LikertField({ label, value, options, disabled, onChange }: LikertFieldProps): React.JSX.Element {
  return (
    <WidgetField label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'secondary' : 'outline'}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.value} · {option.label}
          </Button>
        ))}
      </div>
    </WidgetField>
  )
}

export function SonoWidget({ data, onChange, disabled }: WidgetEditorProps<SonoData>): React.JSX.Element {
  const prefix = useId()
  const resultado = data.mode === 'completo' ? calcularISI7(data) : calcularISI3(data)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={data.mode === 'triagem' ? 'default' : 'outline'}
            aria-pressed={data.mode === 'triagem'}
            disabled={disabled}
            onClick={() => onChange({ ...data, mode: 'triagem' })}
          >
            ISI-3 · Triagem
          </Button>
          <Button
            type="button"
            size="sm"
            variant={data.mode === 'completo' ? 'default' : 'outline'}
            aria-pressed={data.mode === 'completo'}
            disabled={disabled}
            onClick={() => onChange({ ...data, mode: 'completo' })}
          >
            ISI-7 · Completo
          </Button>
        </div>
        <Badge variant="secondary">
          {data.mode === 'completo' ? `${resultado.score}/28` : `${resultado.score}/12`} · {resultado.label}
        </Badge>
      </div>

      {data.mode === 'completo' ? (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-semibold">Dificuldades</p>
          <LikertField
            label="Dificuldade para iniciar o sono"
            value={data.dificuldadeIniciar}
            options={DIFICULDADE_INICIAR_OPTIONS}
            disabled={disabled}
            onChange={(value) => onChange({ ...data, dificuldadeIniciar: value })}
          />
          <LikertField
            label="Dificuldade para manter o sono"
            value={data.dificuldadeManter}
            options={DIFICULDADE_MANTER_OPTIONS}
            disabled={disabled}
            onChange={(value) => onChange({ ...data, dificuldadeManter: value })}
          />
          <LikertField
            label="Despertar muito cedo"
            value={data.despertarCedo}
            options={DESPERTAR_CEDO_OPTIONS}
            disabled={disabled}
            onChange={(value) => onChange({ ...data, despertarCedo: value })}
          />
        </div>
      ) : null}

      <div className="space-y-4 rounded-lg border p-4">
        <p className="text-sm font-semibold">Impacto</p>
        <LikertField
          label="Satisfação com o sono"
          value={data.satisfacaoSono}
          options={SATISFACAO_SONO_OPTIONS}
          disabled={disabled}
          onChange={(value) => onChange({ ...data, satisfacaoSono: value })}
        />
        <LikertField
          label="Interferência nas atividades diárias"
          value={data.interferenciaDiurna}
          options={INTERFERENCIA_DIURNA_OPTIONS}
          disabled={disabled}
          onChange={(value) => onChange({ ...data, interferenciaDiurna: value })}
        />
        {data.mode === 'completo' ? (
          <LikertField
            label="Quão perceptível é o problema para outras pessoas"
            value={data.perceptivelOutros}
            options={PERCEPTIVEL_OUTROS_OPTIONS}
            disabled={disabled}
            onChange={(value) => onChange({ ...data, perceptivelOutros: value })}
          />
        ) : null}
        <LikertField
          label="Preocupação com o sono"
          value={data.preocupacaoSono}
          options={PREOCUPACAO_SONO_OPTIONS}
          disabled={disabled}
          onChange={(value) => onChange({ ...data, preocupacaoSono: value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WidgetField label="Horas dormidas por noite" htmlFor={`${prefix}-horas`}>
          <BoundedNumberInput
            id={`${prefix}-horas`}
            min={0}
            max={14}
            step={0.5}
            value={data.horasDormidas}
            optional
            disabled={disabled}
            onCommit={(value) => onChange({ ...data, horasDormidas: value })}
          />
        </WidgetField>
        <WidgetField label="Despertares durante a noite">
          <div className="flex flex-wrap gap-2">
            {ACORDOU_NOITE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={data.acordouNoite === option.value ? 'secondary' : 'outline'}
                aria-pressed={data.acordouNoite === option.value}
                disabled={disabled}
                onClick={() => onChange({ ...data, acordouNoite: option.value as AcordouNoite })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </WidgetField>
      </div>
    </div>
  )
}
