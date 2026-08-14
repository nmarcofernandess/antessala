/**
 * Widget `medications@1`.
 *
 * A pergunta é sobre o que o paciente toma, não sobre o que está prescrito.
 * Por isso a busca aceita nome comercial: quem responde diz "tomo Losartana"
 * ou "tomo aquele da pressão", e o catálogo resolve para o princípio ativo.
 *
 * O volume importa para o dimensionamento — cinco ou mais medicações somam
 * tempo à consulta — mas quem conta é a lista, não um número digitado à mão.
 */

import { useState } from 'react'
import { Pill, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CLASSES_MEDICAMENTO, buscarMedicamento, comercialQueBate, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import { ChipStatus, CorpoWidget, EtiquetaSecao } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type { DadosMedicacoes, ItemMedicacao } from './tipos'

/** Acima deste volume a regra de dimensionamento soma minutos à consulta. */
const VOLUME_QUE_SOMA = 5

export function WidgetMedicacoes({
  dados,
  onChange,
}: {
  dados: DadosMedicacoes
  onChange: (d: DadosMedicacoes) => void
}) {
  const [adicionando, setAdicionando] = useState(false)

  const positivo = dados.usaMedicacao.estado === 'RESPONDIDO' && dados.usaMedicacao.valor === true
  const total = dados.itens.length
  const somaTempo = total >= VOLUME_QUE_SOMA

  const alterar = (id: string, campo: Partial<ItemMedicacao>) =>
    onChange({ ...dados, itens: dados.itens.map((i) => (i.id === id ? { ...i, ...campo } : i)) })

  /** Classes distintas na lista — o que dá a leitura de polifarmácia. */
  const classes = [...new Set(dados.itens.map((i) => i.classe))]

  return (
    <CorpoWidget>
      <PerguntaChave
        pergunta="O paciente usa alguma medicação atualmente?"
        apoio="Inclui o que ele toma por conta própria, não só o que foi prescrito."
        resposta={dados.usaMedicacao}
        onChange={(r) => onChange({ ...dados, usaMedicacao: r, itens: r.valor ? dados.itens : [] })}
      />

      {positivo && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <EtiquetaSecao>
              {total === 1 ? 'Uma medicação em uso' : `${total} medicações em uso`}
              {classes.length > 1 && ` · ${classes.length} classes`}
            </EtiquetaSecao>
            {somaTempo ? (
              <ChipStatus status="atencao">Volume soma 5 min à consulta</ChipStatus>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                A partir de {VOLUME_QUE_SOMA} medicações o volume soma 5 min — faltam{' '}
                {VOLUME_QUE_SOMA - total}
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="divide-y">
              {dados.itens.map((item) => (
                <LinhaMedicacao
                  key={item.id}
                  item={item}
                  onAlterar={(c) => alterar(item.id, c)}
                  onRemover={() =>
                    onChange({ ...dados, itens: dados.itens.filter((i) => i.id !== item.id) })
                  }
                />
              ))}
            </div>

            {adicionando ? (
              <div className="border-t bg-muted/20 p-3">
                <BuscaCatalogo
                  autoFocus
                  placeholder="Princípio ativo ou nome comercial — “Losartana”, “Selozok”…"
                  rodape={`${TAMANHO_CATALOGOS.medicamentos} princípios · ${TAMANHO_CATALOGOS.comerciais} apelidos · ${CLASSES_MEDICAMENTO.length} classes`}
                  buscar={(t) =>
                    buscarMedicamento(t).map((m) => ({
                      id: m.id,
                      titulo: m.nome,
                      apoio: m.classe,
                      pista: comercialQueBate(m, t) ?? undefined,
                    }))
                  }
                  onEscolher={(r) => {
                    onChange({
                      ...dados,
                      itens: [
                        ...dados.itens,
                        {
                          id: `${r.id}_${dados.itens.length}`,
                          nome: r.titulo,
                          classe: r.apoio ?? '',
                        },
                      ],
                    })
                    setAdicionando(false)
                  }}
                />
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setAdicionando(false)}>
                    Fechar busca
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent/50"
              >
                <Plus className="size-4" />
                Adicionar medicação
              </button>
            )}
          </div>
        </div>
      )}

      {dados.usaMedicacao.estado === 'RESPONDIDO' && dados.usaMedicacao.valor === false && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
          Negativa registrada: o paciente foi perguntado e não usa medicação.
        </p>
      )}
    </CorpoWidget>
  )
}

function LinhaMedicacao({
  item,
  onAlterar,
  onRemover,
}: {
  item: ItemMedicacao
  onAlterar: (c: Partial<ItemMedicacao>) => void
  onRemover: () => void
}) {
  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <Pill className="size-3.5 shrink-0 text-muted-foreground" />

      <span className="min-w-[180px] flex-1">
        <span className="block text-[13px] font-medium leading-tight">{item.nome}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.classe}
        </span>
      </span>

      <Input
        value={item.dose ?? ''}
        placeholder="Dose"
        onChange={(e) => onAlterar({ dose: e.target.value })}
        className="h-8 w-24 text-[13px]"
      />
      <Input
        value={item.frequencia ?? ''}
        placeholder="Frequência"
        onChange={(e) => onAlterar({ frequencia: e.target.value })}
        className="h-8 w-32 text-[13px]"
      />
      <Input
        value={item.ultimoUso ?? ''}
        placeholder="Último uso"
        onChange={(e) => onAlterar({ ultimoUso: e.target.value })}
        className="h-8 w-32 text-[13px]"
      />

      <button
        type="button"
        onClick={onRemover}
        aria-label={`Remover ${item.nome}`}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
