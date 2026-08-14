/**
 * Widget `allergies@1`.
 *
 * O contrato do produto manda a revelação em cascata: a negativa exige pergunta
 * explícita e lista vazia; o positivo exige substância e reação factual. Então
 * a tela pergunta uma coisa de cada vez — respondeu que sim, aparece o quê;
 * disse que é medicamento, entra o catálogo real de 382 princípios ativos.
 */

import { useState, type ReactNode } from 'react'
import { Apple, HandHeart, Pill, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buscarMedicamento, comercialQueBate, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import { ChipStatus, CorpoWidget, Escolha, EtiquetaSecao, type Status } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type {
  DadosAlergias,
  FonteSubstancia,
  Gravidade,
  ItemAlergia,
  TipoReacao,
} from './tipos'

const FONTES: {
  valor: FonteSubstancia
  rotulo: string
  icone: typeof Pill
}[] = [
  { valor: 'MEDICAMENTO', rotulo: 'Medicamento', icone: Pill },
  { valor: 'ALIMENTO', rotulo: 'Alimento', icone: Apple },
  { valor: 'LATEX', rotulo: 'Látex', icone: HandHeart },
  { valor: 'OUTRA', rotulo: 'Outra', icone: ShieldAlert },
]

const GRAVIDADES: { valor: Gravidade; rotulo: string; status: Status }[] = [
  { valor: 'LEVE', rotulo: 'Leve', status: 'adequado' },
  { valor: 'MODERADA', rotulo: 'Moderada', status: 'atencao' },
  { valor: 'GRAVE', rotulo: 'Grave', status: 'critico' },
]

const TIPOS: { valor: TipoReacao; rotulo: string; detalhe: string }[] = [
  { valor: 'ALERGIA', rotulo: 'Alergia', detalhe: 'reação imunológica' },
  { valor: 'INTOLERANCIA', rotulo: 'Intolerância', detalhe: 'sem componente imune' },
  { valor: 'OUTRA_REACAO', rotulo: 'Outra reação', detalhe: 'efeito adverso' },
]

export const statusDaGravidade = (g?: Gravidade): Status =>
  g === 'GRAVE' ? 'critico' : g === 'MODERADA' ? 'atencao' : g === 'LEVE' ? 'adequado' : 'neutro'

export function WidgetAlergias({
  dados,
  onChange,
}: {
  dados: DadosAlergias
  onChange: (d: DadosAlergias) => void
}) {
  const [novo, setNovo] = useState<FonteSubstancia | null>(null)

  const adicionar = (item: Omit<ItemAlergia, 'id'>) => {
    onChange({
      temAlergia: { estado: 'RESPONDIDO', valor: true },
      itens: [...dados.itens, { ...item, id: `alergia_${dados.itens.length + 1}` }],
    })
    setNovo(null)
  }

  const alterar = (id: string, campo: Partial<ItemAlergia>) =>
    onChange({
      ...dados,
      itens: dados.itens.map((i) => (i.id === id ? { ...i, ...campo } : i)),
    })

  const remover = (id: string) =>
    onChange({ ...dados, itens: dados.itens.filter((i) => i.id !== id) })

  const positivo = dados.temAlergia.estado === 'RESPONDIDO' && dados.temAlergia.valor === true

  return (
    <CorpoWidget>
      <PerguntaChave
        pergunta="O paciente tem alergia a algum medicamento, alimento ou material?"
        apoio="Uma negativa aqui vale como resposta registrada, e é diferente de não ter perguntado."
        resposta={dados.temAlergia}
        onChange={(r) => onChange({ ...dados, temAlergia: r, itens: r.valor ? dados.itens : [] })}
        statusQuandoSim="critico"
      />

      {positivo && (
        <div className="@container space-y-3">
          <EtiquetaSecao>
            {dados.itens.length === 1 ? 'Uma alergia relatada' : `${dados.itens.length} alergias relatadas`}
          </EtiquetaSecao>

          {dados.itens.map((item) => (
            <CartaoAlergia
              key={item.id}
              item={item}
              onAlterar={(c) => alterar(item.id, c)}
              onRemover={() => remover(item.id)}
            />
          ))}

          {novo === null ? (
            /* O convite para incluir mais uma: quatro portas de entrada com o
               mesmo peso, e não uma barra de ferramentas espremida num canto. */
            <div className="rounded-xl border border-dashed px-4 py-3.5">
              <EtiquetaSecao>Adicionar alergia a</EtiquetaSecao>
              <div className="mt-2.5 max-w-[560px]">
                <Escolha
                  opcoes={FONTES.map((f) => ({
                    valor: f.valor,
                    rotulo: f.rotulo,
                    icone: f.icone,
                  }))}
                  valor={undefined}
                  onChange={setNovo}
                  colunas={4}
                />
              </div>
            </div>
          ) : (
            <NovaAlergia fonte={novo} onCancelar={() => setNovo(null)} onConfirmar={adicionar} />
          )}
        </div>
      )}

      {dados.temAlergia.estado === 'RESPONDIDO' && dados.temAlergia.valor === false && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
          Negativa registrada: a enfermagem perguntou e o paciente respondeu que não tem
          alergia conhecida. A lista fica vazia por consequência, não por omissão.
        </p>
      )}
    </CorpoWidget>
  )
}

/* ══════════════ cartão de um item ══════════════ */

/**
 * Linha de classificação: rótulo à esquerda, opções à direita.
 *
 * As duas linhas compartilham a mesma coluna de rótulo e a mesma grade de três
 * opções, então gravidade e natureza se leem em colunas que batem — em vez do
 * degrau que aparecia quando cada uma ficava num lado de um grid de dois.
 */
function LinhaClassificacao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 @2xl:grid-cols-[164px_minmax(0,1fr)] @2xl:items-center">
      <div>
        <EtiquetaSecao>{rotulo}</EtiquetaSecao>
      </div>
      <div className="max-w-[560px]">{children}</div>
    </div>
  )
}

function CartaoAlergia({
  item,
  onAlterar,
  onRemover,
}: {
  item: ItemAlergia
  onAlterar: (c: Partial<ItemAlergia>) => void
  onRemover: () => void
}) {
  const fonte = FONTES.find((f) => f.valor === item.fonte)!
  const status = statusDaGravidade(item.gravidade)

  return (
    <div className="group @container rounded-xl border bg-card px-4 py-3.5">
      {/* Quem é a alergia e o que aconteceu — o relato antes da classificação. */}
      <div className="flex items-start gap-3">
        <fonte.icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium leading-snug">{item.substancia}</span>
            {item.classe && (
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {item.classe}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.reacao}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.gravidade && (
            <ChipStatus status={status}>
              {GRAVIDADES.find((g) => g.valor === item.gravidade)?.rotulo}
            </ChipStatus>
          )}
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover ${item.substancia}`}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Indentado até o texto do cabeçalho: a classificação pertence ao que
          está escrito acima, e o alinhamento é quem diz isso. */}
      <div className="mt-3.5 space-y-2 border-t pt-3.5 @2xl:ml-7">
        <LinhaClassificacao rotulo="Gravidade documentada">
          <Escolha
            opcoes={GRAVIDADES.map((g) => ({
              valor: g.valor,
              rotulo: g.rotulo,
              status: g.status,
            }))}
            valor={item.gravidade}
            onChange={(v) => onAlterar({ gravidade: v })}
            colunas={3}
          />
        </LinhaClassificacao>
        <LinhaClassificacao rotulo="Natureza da reação">
          <Escolha
            opcoes={TIPOS.map((t) => ({
              valor: t.valor,
              rotulo: t.rotulo,
              detalhe: t.detalhe,
            }))}
            valor={item.tipo}
            onChange={(v) => onAlterar({ tipo: v })}
            colunas={3}
          />
        </LinhaClassificacao>
      </div>
    </div>
  )
}

/* ══════════════ novo item ══════════════ */

function NovaAlergia({
  fonte,
  onCancelar,
  onConfirmar,
}: {
  fonte: FonteSubstancia
  onCancelar: () => void
  onConfirmar: (item: Omit<ItemAlergia, 'id'>) => void
}) {
  const [substancia, setSubstancia] = useState('')
  const [classe, setClasse] = useState<string | undefined>()
  const [reacao, setReacao] = useState('')

  const def = FONTES.find((f) => f.valor === fonte)!
  const completo = substancia.trim().length > 0 && reacao.trim().length > 0

  return (
    <div className="space-y-3.5 rounded-xl border border-dashed bg-card px-4 py-3.5">
      <div className="flex items-center gap-2">
        <def.icone className="size-4 text-muted-foreground" />
        <EtiquetaSecao>Alergia a {def.rotulo.toLowerCase()}</EtiquetaSecao>
      </div>

      {fonte === 'MEDICAMENTO' ? (
        substancia ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{substancia}</span>
              {classe && (
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {classe}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setSubstancia('')
                setClasse(undefined)
              }}
            >
              Trocar
            </Button>
          </div>
        ) : (
          <BuscaCatalogo
            autoFocus
            placeholder="Princípio ativo ou nome comercial — “Dipirona”, “Novalgina”…"
            rodape={`${TAMANHO_CATALOGOS.medicamentos} princípios ativos · ${TAMANHO_CATALOGOS.comerciais} nomes comerciais`}
            buscar={(t) =>
              buscarMedicamento(t).map((m) => ({
                id: m.id,
                titulo: m.nome,
                apoio: m.classe,
                pista: comercialQueBate(m, t) ?? undefined,
              }))
            }
            onEscolher={(r) => {
              setSubstancia(r.titulo)
              setClasse(r.apoio)
            }}
          />
        )
      ) : (
        <Input
          autoFocus
          value={substancia}
          placeholder={
            fonte === 'ALIMENTO'
              ? 'Qual alimento?'
              : fonte === 'LATEX'
                ? 'Material — luva, adesivo, cateter…'
                : 'Qual substância?'
          }
          onChange={(e) => setSubstancia(e.target.value)}
        />
      )}

      {substancia && (
        <div className="space-y-1.5">
          <label htmlFor="reacao">
            <EtiquetaSecao>Que reação ele teve?</EtiquetaSecao>
          </label>
          <Input
            id="reacao"
            autoFocus
            value={reacao}
            placeholder="Descreva o que aconteceu, com as palavras do paciente"
            onChange={(e) => setReacao(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={!completo}
          onClick={() => onConfirmar({ fonte, substancia, classe, reacao })}
        >
          <Plus className={cn('size-3.5', !completo && 'opacity-50')} />
          Registrar alergia
        </Button>
      </div>
    </div>
  )
}
