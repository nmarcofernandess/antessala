import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  createAnamneseId,
  type ProblemaSaude,
  type ProblemasSaudeData,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { WidgetEditorProps } from '../types'
import { RequiredDraftInput, WidgetField } from './WidgetFields'

export function ProblemasSaudeWidget({
  data,
  onChange,
  disabled,
  catalogs,
}: WidgetEditorProps<ProblemasSaudeData>): React.JSX.Element {
  const prefix = useId()
  const listId = `${prefix}-cid`
  const [draft, setDraft] = useState<ProblemaSaude | null>(null)

  const updateProblema = (id: string, patch: Partial<ProblemaSaude>): void => {
    onChange({
      ...data,
      problemas: data.problemas.map((problema) => problema.id === id ? { ...problema, ...patch } : problema),
    })
  }

  const withResolvedNome = (problema: ProblemaSaude, nome: string): ProblemaSaude => {
    const catalogItem = catalogs?.problemasSaude?.find(
      (item) => item.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0,
    )
    return {
      ...problema,
      nome,
      codigo: catalogItem?.codigo ?? problema.codigo,
    }
  }

  const rows = draft ? [...data.problemas, draft] : data.problemas

  return (
    <div className="space-y-4">
      <datalist id={listId}>
        {catalogs?.problemasSaude?.map((problema) => (
          <option key={String(problema.id ?? `${problema.codigo}-${problema.nome}`)} value={problema.nome}>
            {problema.codigo}
          </option>
        ))}
      </datalist>

      <div className="space-y-3">
        {rows.map((problema, index) => {
          const isDraft = draft?.id === problema.id
          const patchProblema = (patch: Partial<ProblemaSaude>): void => {
            if (isDraft) {
              setDraft((current) => current ? { ...current, ...patch } : current)
            } else {
              updateProblema(problema.id, patch)
            }
          }
          const nameId = `${prefix}-problema-${index}-nome`

          return (
            <div key={problema.id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Condição {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover condição ${index + 1}`}
                disabled={disabled}
                onClick={() => {
                  if (isDraft) {
                    setDraft(null)
                  } else {
                    onChange({
                      ...data,
                      problemas: data.problemas.filter((item) => item.id !== problema.id),
                    })
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <WidgetField label="Nome da condição" htmlFor={nameId}>
                <RequiredDraftInput
                  id={nameId}
                  list={listId}
                  value={problema.nome}
                  disabled={disabled}
                  emptyError="Informe o nome da condição."
                  onCommit={(nome) => {
                    const resolved = withResolvedNome(problema, nome)
                    if (isDraft) {
                      onChange({ ...data, problemas: [...data.problemas, resolved] })
                      setDraft(null)
                    } else {
                      updateProblema(problema.id, resolved)
                    }
                  }}
                />
              </WidgetField>
              <WidgetField label="CID-10">
                <Input
                  value={problema.codigo ?? ''}
                  disabled={disabled}
                  onChange={(event) => patchProblema({ codigo: event.target.value || undefined })}
                />
              </WidgetField>
              <WidgetField label="Desde">
                <Input
                  value={problema.desde ?? ''}
                  disabled={disabled}
                  placeholder="Ex.: há 2 anos"
                  onChange={(event) => patchProblema({ desde: event.target.value || undefined })}
                />
              </WidgetField>
              <WidgetField label="Controle">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={problema.controlado === undefined ? '' : String(problema.controlado)}
                  disabled={disabled}
                  onChange={(event) => patchProblema({
                    controlado: event.target.value === '' ? undefined : event.target.value === 'true',
                  })}
                >
                  <option value="">Não informado</option>
                  <option value="true">Controlado</option>
                  <option value="false">Não controlado</option>
                </select>
              </WidgetField>
            </div>
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
        <Plus /> Adicionar condição
      </Button>

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
