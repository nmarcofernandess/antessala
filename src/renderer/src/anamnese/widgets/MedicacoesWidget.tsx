import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  FREQUENCIA_LABELS,
  MEDICACAO_FREQUENCIA_OPTIONS,
  createAnamneseId,
  type Medicacao,
  type MedicacaoFrequencia,
  type MedicacoesData,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

import type { WidgetEditorProps } from '../types'
import { RequiredDraftInput, WidgetField } from './WidgetFields'

export function MedicacoesWidget({
  data,
  onChange,
  disabled,
  catalogs,
}: WidgetEditorProps<MedicacoesData>): React.JSX.Element {
  const prefix = useId()
  const listId = `${prefix}-medicamentos`
  const [draft, setDraft] = useState<Medicacao | null>(null)

  const updateMedicacao = (id: string, patch: Partial<Medicacao>): void => {
    onChange({
      ...data,
      medicacoes: data.medicacoes.map((medicacao) => medicacao.id === id ? { ...medicacao, ...patch } : medicacao),
    })
  }

  const removeMedicacao = (id: string): void => {
    onChange({ ...data, medicacoes: data.medicacoes.filter((medicacao) => medicacao.id !== id) })
  }

  const commitDraft = (nome: string): void => {
    if (!draft) return
    onChange({
      ...data,
      medicacoes: [...data.medicacoes, { ...draft, nome }],
    })
    setDraft(null)
  }

  const rows = draft ? [...data.medicacoes, draft] : data.medicacoes

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={data.naoUsaMedicamentos ?? false}
          disabled={disabled}
          onCheckedChange={(checked) => {
            if (checked === true) setDraft(null)
            onChange({
              ...data,
              naoUsaMedicamentos: checked === true || undefined,
              medicacoes: checked === true ? [] : data.medicacoes,
            })
          }}
        />
        Não utiliza medicamentos de uso contínuo
      </label>

      {!data.naoUsaMedicamentos ? (
        <>
          <datalist id={listId}>
            {catalogs?.medicacoes?.map((medicacao) => (
              <option key={String(medicacao.id ?? medicacao.nome)} value={medicacao.nome}>
                {medicacao.classeTerapeutica ?? ''}
              </option>
            ))}
          </datalist>

          <div className="space-y-3">
            {rows.map((medicacao, index) => {
              const isDraft = draft?.id === medicacao.id
              const patchMedicacao = (patch: Partial<Medicacao>): void => {
                if (isDraft) {
                  setDraft((current) => current ? { ...current, ...patch } : current)
                } else {
                  updateMedicacao(medicacao.id, patch)
                }
              }
              const nameId = `${prefix}-medicacao-${index}-nome`

              return (
                <div key={medicacao.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Medicação {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover medicação ${index + 1}`}
                    disabled={disabled}
                    onClick={() => isDraft ? setDraft(null) : removeMedicacao(medicacao.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <WidgetField label="Nome da medicação" htmlFor={nameId}>
                    <RequiredDraftInput
                      id={nameId}
                      list={listId}
                      value={medicacao.nome}
                      disabled={disabled}
                      emptyError="Informe o nome da medicação."
                      onCommit={(nome) => isDraft
                        ? commitDraft(nome)
                        : updateMedicacao(medicacao.id, { nome })}
                    />
                  </WidgetField>
                  <WidgetField label="Dose">
                    <Input
                      value={medicacao.dose ?? ''}
                      disabled={disabled}
                      placeholder="Ex.: 850 mg"
                      onChange={(event) => patchMedicacao({ dose: event.target.value || undefined })}
                    />
                  </WidgetField>
                  <WidgetField label="Frequência">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={medicacao.frequencia ?? ''}
                      disabled={disabled}
                      onChange={(event) => patchMedicacao({
                        frequencia: (event.target.value || undefined) as MedicacaoFrequencia | undefined,
                      })}
                    >
                      <option value="">Não informada</option>
                      {MEDICACAO_FREQUENCIA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </WidgetField>
                  <WidgetField label="Motivo">
                    <Input
                      value={medicacao.motivo ?? ''}
                      disabled={disabled}
                      placeholder="Ex.: diabetes"
                      onChange={(event) => patchMedicacao({ motivo: event.target.value || undefined })}
                    />
                  </WidgetField>
                </div>
                {medicacao.frequencia ? (
                  <p className="text-xs text-muted-foreground">{FREQUENCIA_LABELS[medicacao.frequencia]}</p>
                ) : null}
                </div>
              )
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={disabled || draft !== null}
            onClick={() => setDraft({ id: createAnamneseId(), nome: '' })}
          >
            <Plus /> Adicionar medicação
          </Button>
        </>
      ) : null}
    </div>
  )
}
