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

import { useState, type ReactNode } from 'react'
import { Plus, Stethoscope, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buscarCid, COMORBIDADES, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import { ChipStatus, CorpoWidget, EtiquetaSecao } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type { DadosDiagnosticos, ItemDiagnostico } from './tipos'

/** Acima deste volume a regra de dimensionamento soma minutos à consulta. */
const VOLUME_QUE_SOMA = 3

/** Célula editável: sem caixa em repouso, a caixa aparece ao tocar. */
const CELULA =
  'h-8 rounded-md border-transparent bg-transparent px-2 text-[13px] shadow-none transition-colors hover:bg-muted/60 focus-visible:border-input focus-visible:bg-background'

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
        <div className="@container space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <EtiquetaSecao>
              {total === 1 ? 'Um diagnóstico' : `${total} diagnósticos`}
            </EtiquetaSecao>
            {somaTempo && <ChipStatus status="atencao">Volume soma 5 min à consulta</ChipStatus>}
          </div>

          <div className="space-y-2.5">
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
            <div className="space-y-3.5 rounded-xl border border-dashed bg-card px-4 py-3.5">
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

              {/* Atalhos em grade: o código fica sempre na mesma borda direita,
                  então a lista se lê em coluna em vez de nuvem de etiquetas. */}
              <div>
                <EtiquetaSecao>Atalhos frequentes na pré-anestésica</EtiquetaSecao>
                <div className="mt-2 grid gap-1.5 @lg:grid-cols-2">
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
                        className="flex items-baseline justify-between gap-3 rounded-lg border px-3 py-1.5 text-left transition-colors hover:bg-accent"
                      >
                        <span className="truncate text-[12px] first-letter:uppercase">
                          {c.rotulo}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {cid.codigo}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end border-t pt-3">
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

/**
 * Linha de relato: rótulo à esquerda, o que foi dito à direita.
 *
 * Em coluna única o texto do paciente cabe inteiro — lado a lado ele era
 * cortado no meio da frase, que é justamente a parte que interessa.
 */
function LinhaRelato({
  rotulo,
  htmlFor,
  children,
}: {
  rotulo: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-x-4 gap-y-1 @2xl:grid-cols-[184px_minmax(0,1fr)] @2xl:items-start">
      {/* Alinhado ao topo: quando o rótulo ocupa duas linhas, ele continua
          começando na mesma altura do que foi respondido. */}
      <label htmlFor={htmlFor} className="@2xl:pt-[9px]">
        <EtiquetaSecao>{rotulo}</EtiquetaSecao>
      </label>
      {children}
    </div>
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
    <div className="group @container rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Stethoscope className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium leading-snug">{item.descricao}</span>
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

      {/* Indentado até o texto do cabeçalho: o relato pertence ao diagnóstico
          nomeado acima, e o alinhamento é quem diz isso. */}
      <div className="mt-3.5 space-y-1.5 border-t pt-3 @2xl:ml-7">
        <LinhaRelato rotulo="Sintomas hoje" htmlFor={`sintomas_${item.id}`}>
          <Input
            id={`sintomas_${item.id}`}
            value={item.sintomasAtuais ?? ''}
            placeholder="O que ele sente agora"
            onChange={(e) => onAlterar({ sintomasAtuais: e.target.value })}
            className={cn(CELULA, '-ml-2')}
          />
        </LinhaRelato>
        <LinhaRelato rotulo="Nas palavras do paciente" htmlFor={`controle_${item.id}`}>
          <Input
            id={`controle_${item.id}`}
            value={item.controlePaciente ?? ''}
            placeholder="“Está controlada com o remédio”"
            onChange={(e) => onAlterar({ controlePaciente: e.target.value })}
            className={cn(CELULA, '-ml-2')}
          />
        </LinhaRelato>
      </div>
    </div>
  )
}
