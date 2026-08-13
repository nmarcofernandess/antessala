import { Plus, Trash2 } from 'lucide-react'

import {
  REGISTRO_TIPO_CONFIG,
  createAnamneseId,
  type RegistroDia,
  type RegistroTipo,
  type RotinaAlimentarData,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { WidgetEditorProps } from '../types'
import { WidgetField } from './WidgetFields'

export function RotinaAlimentarWidget({
  data,
  onChange,
  disabled,
}: WidgetEditorProps<RotinaAlimentarData>): React.JSX.Element {
  const updateRegistro = (id: string, patch: Partial<RegistroDia>): void => {
    onChange({
      registros: data.registros.map((registro) => registro.id === id ? { ...registro, ...patch } : registro),
    })
  }

  return (
    <div className="space-y-4">
      {data.registros.map((registro, index) => (
        <div key={registro.id} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Registro {index + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover registro ${index + 1}`}
              disabled={disabled}
              onClick={() => onChange({ registros: data.registros.filter((item) => item.id !== registro.id) })}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <WidgetField label="Tipo">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={registro.tipo}
                disabled={disabled}
                onChange={(event) => updateRegistro(registro.id, { tipo: event.target.value as RegistroTipo })}
              >
                {(Object.keys(REGISTRO_TIPO_CONFIG) as RegistroTipo[]).map((tipo) => (
                  <option key={tipo} value={tipo}>{REGISTRO_TIPO_CONFIG[tipo].label}</option>
                ))}
              </select>
            </WidgetField>
            <WidgetField label="Título">
              <Input
                value={registro.titulo}
                disabled={disabled}
                placeholder={REGISTRO_TIPO_CONFIG[registro.tipo].label}
                onChange={(event) => updateRegistro(registro.id, { titulo: event.target.value })}
              />
            </WidgetField>
            <WidgetField label="Horário">
              <Input
                type="time"
                value={registro.horario ?? ''}
                disabled={disabled}
                onChange={(event) => updateRegistro(registro.id, { horario: event.target.value || undefined })}
              />
            </WidgetField>
          </div>
          <WidgetField label="Descrição">
            <Textarea
              value={registro.descricao}
              disabled={disabled}
              placeholder={REGISTRO_TIPO_CONFIG[registro.tipo].placeholder}
              onChange={(event) => updateRegistro(registro.id, { descricao: event.target.value })}
            />
          </WidgetField>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onChange({
          registros: [...data.registros, {
            id: createAnamneseId(),
            tipo: 'alimento',
            titulo: '',
            descricao: '',
          }],
        })}
      >
        <Plus /> Adicionar registro
      </Button>
    </div>
  )
}
