import { useId } from 'react'

import type { ObservacoesGeraisData } from '@shared/anamnese'

import { Textarea } from '@/components/ui/textarea'

import type { WidgetEditorProps } from '../types'
import { WidgetField } from './WidgetFields'

export function ObservacoesGeraisWidget({
  data,
  onChange,
  disabled,
}: WidgetEditorProps<ObservacoesGeraisData>): React.JSX.Element {
  const id = useId()
  return (
    <WidgetField label="Observações" htmlFor={id}>
      <Textarea
        id={id}
        className="min-h-32"
        value={data.texto}
        disabled={disabled}
        placeholder="Registre informações relevantes da anamnese."
        onChange={(event) => onChange({ texto: event.target.value })}
      />
    </WidgetField>
  )
}
