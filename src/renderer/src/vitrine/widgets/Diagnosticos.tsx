/**
 * Widget `diagnoses@1`.
 *
 * O CID-10 embarcado guarda os termos que as pessoas realmente digitam — "dm2"
 * encontra E11, "pressão alta" encontra I10 — porque quem conduz a entrevista
 * não decora código. O código aparece depois, como consequência da escolha.
 *
 * A frase de controle é do paciente, não do sistema: "controlada" só é
 * verdade se alguém disse isso.
 */

import { useState } from 'react'
import { Plus, Stethoscope, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buscarCid, COMORBIDADES, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import { ChipStatus, CorpoWidget, EtiquetaSecao } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type { DadosDiagnosticos, ItemDiagnostico } from './tipos'

/** Acima deste volume a regra de dimensionamento soma minutos à consulta. */
const VOLUME_QUE_SOMA = 3

export function WidgetDiagnosticos({
  dados,
  onChange,
}: {
  dados: DadosDiagnosticos
  onChange: (d: DadosDiagnosticos) => void
}) {
  const [adicionando, setAdicionando] = useState(false)

  const positivo =
    dados.temDiagnostico.estado === 'RESPONDIDO' && dados.temDiagnostico.valor === true
  const total = dados.itens.length
  const somaTempo = total >= VOLUME_QUE_SOMA

  const adicionar = (item: Omit<ItemDiagnostico, 'id'>) => {
    onChange({
      temDiagnostico: { estado: 'RESPONDIDO', valor: true },
      itens: [...dados.itens, { ...item, id: `${item.codigo}_${dados.itens.length}` }],
    })
    setAdicionando(false)
  }

  const alterar = (id: string, campo: Partial<ItemDiagnostico>) =>
    onChange({ ...dados, itens: dados.itens.map((i) => (i.id === id ? { ...i, ...campo } : i)) })

  return (
    <CorpoWidget>
      <PerguntaChave
        pergunta="O paciente tem alguma doença ou condição já diagnosticada?"
        apoio="Vale o que já foi dito a ele por um profissional — o app não diagnostica nada."
        resposta={dados.temDiagnostico}
        onChange={(r) =>
          onChange({ ...dados, temDiagnostico: r, itens: r.valor ? dados.itens : [] })
        }
      />

      {positivo && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <EtiquetaSecao>
              {total === 1 ? 'Um diagnóstico' : `${total} diagnósticos`}
            </EtiquetaSecao>
            {somaTempo && <ChipStatus status="atencao">Volume soma 5 min à consulta</ChipStatus>}
          </div>

          <div className="space-y-2">
            {dados.itens.map((item) => (
              <CartaoDiagnostico
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
            <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-3">
              <BuscaCatalogo
                autoFocus
                placeholder="Diagnóstico ou código — “diabetes”, “dm2”, “I10”…"
                rodape={`CID-10 completo · ${TAMANHO_CATALOGOS.cid} categorias`}
                buscar={(t) =>
                  buscarCid(t).map((c) => ({
                    id: c.codigo,
                    titulo: c.descricao,
                    apoio: c.capitulo,
                    codigo: c.codigo,
                  }))
                }
                onEscolher={(r) =>
                  adicionar({
                    codigo: r.codigo!,
                    descricao: r.titulo,
                    capitulo: r.apoio ?? '',
                  })
                }
              />

              <div>
                <EtiquetaSecao>Atalhos frequentes na pré-anestésica</EtiquetaSecao>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {COMORBIDADES.slice(0, 8).map((c) => {
                    const cid = c.cid[0]
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          adicionar({
                            codigo: cid.codigo,
                            descricao: cid.descricao,
                            capitulo: '',
                          })
                        }
                        className="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:bg-accent"
                      >
                        {c.rotulo}
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                          {cid.codigo}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAdicionando(false)}>
                  Fechar busca
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdicionando(true)}>
              <Plus className="size-4" />
              Adicionar diagnóstico
            </Button>
          )}
        </div>
      )}

      {dados.temDiagnostico.estado === 'RESPONDIDO' && dados.temDiagnostico.valor === false && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
          Negativa registrada: nenhum diagnóstico prévio relatado.
        </p>
      )}
    </CorpoWidget>
  )
}

function CartaoDiagnostico({
  item,
  onAlterar,
  onRemover,
}: {
  item: ItemDiagnostico
  onAlterar: (c: Partial<ItemDiagnostico>) => void
  onRemover: () => void
}) {
  return (
    <div className="group rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <Stethoscope className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium">{item.descricao}</span>
            <span className="rounded border px-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {item.codigo}
            </span>
          </div>
          {item.capitulo && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.capitulo}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${item.descricao}`}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">Sintomas hoje</label>
          <Input
            value={item.sintomasAtuais ?? ''}
            placeholder="O que ele sente agora"
            onChange={(e) => onAlterar({ sintomasAtuais: e.target.value })}
            className="h-8 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">
            Nas palavras do paciente
          </label>
          <Input
            value={item.controlePaciente ?? ''}
            placeholder="“Está controlada com o remédio”"
            onChange={(e) => onAlterar({ controlePaciente: e.target.value })}
            className="h-8 text-[13px]"
          />
        </div>
      </div>
    </div>
  )
}
