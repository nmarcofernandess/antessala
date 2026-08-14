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
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CLASSES_MEDICAMENTO, buscarMedicamento, comercialQueBate, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import { ChipStatus, CorpoWidget, EtiquetaSecao } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type { DadosMedicacoes, ItemMedicacao } from './tipos'

/** Acima deste volume a regra de dimensionamento soma minutos à consulta. */
const VOLUME_QUE_SOMA = 5

/**
 * A grade da tabela, uma só, usada pelo cabeçalho e por toda linha — é o que
 * garante que dose, frequência e último uso caiam na mesma coluna em todas.
 */
const GRADE =
  '@2xl:grid-cols-[minmax(0,2.2fr)_minmax(72px,1fr)_minmax(96px,1.2fr)_minmax(96px,1.2fr)_24px] @2xl:gap-x-3'

/** Célula editável: sem caixa em repouso, a caixa aparece ao tocar. */
const CELULA =
  'h-8 rounded-md border-transparent bg-transparent px-2 text-[13px] tabular-nums shadow-none transition-colors hover:bg-muted/60 focus-visible:border-input focus-visible:bg-background'

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
        <div className="@container space-y-3">
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

          <div className="overflow-hidden rounded-xl border bg-card">
            {/* Cabeçalho de colunas: só quando há largura para a tabela inteira.
                No estreito cada linha vira um cartão e os placeholders bastam. */}
            <div className={cn('hidden border-b bg-muted/30 px-4 py-2', GRADE, '@2xl:grid')}>
              <EtiquetaSecao>Medicação</EtiquetaSecao>
              <span className="pl-2">
                <EtiquetaSecao>Dose</EtiquetaSecao>
              </span>
              <span className="pl-2">
                <EtiquetaSecao>Frequência</EtiquetaSecao>
              </span>
              <span className="pl-2">
                <EtiquetaSecao>Último uso</EtiquetaSecao>
              </span>
              <span aria-hidden />
            </div>

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
    <div
      className={cn(
        'group grid grid-cols-[minmax(0,1fr)_24px] items-center gap-x-3 gap-y-2 px-4 py-2.5',
        'transition-colors hover:bg-muted/25',
        GRADE,
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight">{item.nome}</span>
        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.classe}
        </span>
      </span>

      {/* No estreito os três campos formam a segunda linha do cartão; a partir
          de `@2xl` viram células da tabela, na mesma grade do cabeçalho. */}
      <div className="col-span-2 -ml-2 grid grid-cols-3 gap-2 @2xl:contents">
        <Input
          value={item.dose ?? ''}
          placeholder="Dose"
          aria-label={`Dose de ${item.nome}`}
          onChange={(e) => onAlterar({ dose: e.target.value })}
          className={CELULA}
        />
        <Input
          value={item.frequencia ?? ''}
          placeholder="Frequência"
          aria-label={`Frequência de ${item.nome}`}
          onChange={(e) => onAlterar({ frequencia: e.target.value })}
          className={CELULA}
        />
        <Input
          value={item.ultimoUso ?? ''}
          placeholder="Último uso"
          aria-label={`Último uso de ${item.nome}`}
          onChange={(e) => onAlterar({ ultimoUso: e.target.value })}
          className={CELULA}
        />
      </div>

      <button
        type="button"
        onClick={onRemover}
        aria-label={`Remover ${item.nome}`}
        className="col-start-2 row-start-1 justify-self-end rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 @2xl:col-start-auto @2xl:row-start-auto"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
