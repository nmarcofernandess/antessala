/**
 * Repertório › Widgets — tudo que existe para perguntar.
 *
 * Duas gramáticas, e a distinção importa: os widgets do **Antessala** são os que
 * um protocolo pode incluir, e cada um mostra em quantos protocolos já entrou —
 * é o que separa um catálogo de uma galeria. Os do **DietFlow** são herança: a
 * prova de que o padrão de widget já existia e foi adaptado, não inventado para
 * a demonstração. Nenhum deles entra em protocolo pré-anestésico.
 *
 * Todo cartão renderiza o widget de verdade, editável. Ver a pergunta funcionando
 * é o único jeito honesto de decidir se ela pertence à composição.
 */

import { useMemo, useState, type ComponentType } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Rotulo } from '@/vitrine/pecas'
import { CATEGORIAS, WIDGETS, type Categoria } from '@/vitrine/widgets/registro'
import { WIDGETS_DIETFLOW } from '@/vitrine/widgets/registroDietFlow'
import { useProtocolos } from '@/vitrine/protocolos-store'

/** O mínimo que um cartão precisa saber. Os dois registros satisfazem isto. */
type DefExibivel = {
  tipo: string
  nome: string
  descricao: string
  icone: LucideIcon
  Componente: ComponentType<{ dados: never; onChange: (d: never) => void }>
  dadosIniciais: () => unknown
  resumo: (d: never) => string
}

const ORDEM_CATEGORIAS: Categoria[] = ['contexto', 'antecedentes', 'sistemas', 'medidas', 'apoio']

/** Agrupamento da herança pela natureza da resposta, que é o que muda entre eles. */
const GRUPOS_DIETFLOW: { rotulo: string; nota: string; tipos: string[] }[] = [
  {
    rotulo: 'Escalas e scores',
    nota: 'Perguntas fechadas que somam um número com faixa nomeada.',
    tipos: ['sono', 'bristol'],
  },
  {
    rotulo: 'Medidas',
    nota: 'Um valor contínuo lido contra a meta que o próprio widget calcula.',
    tipos: ['hidratacao', 'adesao'],
  },
  {
    rotulo: 'Listas',
    nota: 'Itens em colunas: o que existe, desde quando, em que estado.',
    tipos: ['rotina_alimentar', 'problemas_saude', 'medicacoes_dietflow'],
  },
  {
    rotulo: 'Texto',
    nota: 'O que não coube em campo nenhum.',
    tipos: ['observacoes_gerais'],
  },
]

/** Agrupa o registro sem perder nada: o que não tem grupo cai no último. */
const DIETFLOW_MONTADO = (() => {
  const montados = GRUPOS_DIETFLOW.map((g) => ({
    ...g,
    itens: WIDGETS_DIETFLOW.filter((w) => g.tipos.includes(w.tipo)),
  }))
  const cobertos = new Set(GRUPOS_DIETFLOW.flatMap((g) => g.tipos))
  const restantes = WIDGETS_DIETFLOW.filter((w) => !cobertos.has(w.tipo))
  if (restantes.length) montados[montados.length - 1].itens.push(...restantes)
  return montados.filter((g) => g.itens.length > 0)
})()

function semAcento(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function PainelWidgets() {
  const { protocolos } = useProtocolos()
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>(['allergies'])

  const alternar = (tipo: string) =>
    setAbertos((a) => (a.includes(tipo) ? a.filter((x) => x !== tipo) : [...a, tipo]))

  /** Em quantos protocolos ativos cada widget entrou. Zero também é resposta. */
  const usoPorTipo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of protocolos) {
      for (const tipo of p.blocos) mapa.set(tipo, (mapa.get(tipo) ?? 0) + 1)
    }
    return mapa
  }, [protocolos])

  const termo = semAcento(busca.trim())
  const bate = (d: { nome: string; descricao: string }) =>
    !termo || semAcento(`${d.nome} ${d.descricao}`).includes(termo)

  const porCategoria = ORDEM_CATEGORIAS.map((categoria) => ({
    categoria,
    itens: WIDGETS.filter((w) => w.categoria === categoria && bate(w)),
  })).filter((g) => g.itens.length > 0)

  const dietflow = DIETFLOW_MONTADO.map((g) => ({
    ...g,
    itens: g.itens.filter(bate),
  })).filter((g) => g.itens.length > 0)

  const vazio = porCategoria.length === 0 && dietflow.length === 0

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto w-full max-w-4xl px-6 py-6 lg:px-8">
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar widget pelo nome ou pelo que ele pergunta"
            className="pl-9"
          />
        </div>

        {/* ─────────── catálogo do Antessala ─────────── */}
        {porCategoria.length > 0 && (
          <section className="mb-12">
            <div className="mb-6 border-b pb-3">
              <h2 className="text-lg font-semibold tracking-tight">Widgets do Antessala</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Os blocos que um protocolo pode incluir. O contador diz em quantas composições
                cada um já entrou — não quanta importância ele tem.
              </p>
            </div>

            <div className="space-y-8">
              {porCategoria.map((g) => (
                <section key={g.categoria}>
                  <div className="border-b pb-2">
                    <Rotulo>{CATEGORIAS[g.categoria]}</Rotulo>
                  </div>
                  <div className="mt-3 space-y-2">
                    {g.itens.map((w) => (
                      <CartaoWidget
                        key={w.tipo}
                        def={w as unknown as DefExibivel}
                        aberto={abertos.includes(w.tipo)}
                        onAlternar={() => alternar(w.tipo)}
                        uso={usoPorTipo.get(w.tipo) ?? 0}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        {/* ─────────── herança ─────────── */}
        {dietflow.length > 0 && (
          <section>
            <div className="mb-6 border-b pb-3">
              <h2 className="text-lg font-semibold tracking-tight">Herança do DietFlow</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Os oito widgets do composer clínico do DietFlow, com respostas reais de uma
                consulta nutricional. É daqui que vem a gramática: escala que se lê de relance,
                score que se explica sozinho, meta ao lado do valor.
              </p>
            </div>

            <div className="space-y-8">
              {dietflow.map((g) => (
                <section key={g.rotulo}>
                  {/* Sem contagem ao lado do rótulo: em versalete monoespaçado o
                      número gruda na etiqueta e é lido como parte do nome. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
                    <Rotulo>{g.rotulo}</Rotulo>
                    <span className="text-[11.5px] text-muted-foreground">{g.nota}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {g.itens.map((w) => (
                      <CartaoWidget
                        key={w.tipo}
                        def={w as unknown as DefExibivel}
                        aberto={abertos.includes(w.tipo)}
                        onAlternar={() => alternar(w.tipo)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-9 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
              Nenhum destes blocos entra no protocolo pré-anestésico nem soma minutos à consulta.
              Eles são o repertório de origem — a prova de que o padrão de widget já existia e foi
              adaptado, não inventado para a demonstração.
            </p>
          </section>
        )}

        {vazio && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum widget com esse nome.
          </p>
        )}
      </div>
    </ScrollArea>
  )
}

function CartaoWidget({
  def,
  aberto,
  onAlternar,
  uso,
}: {
  def: DefExibivel
  aberto: boolean
  onAlternar: () => void
  /** Quantos protocolos incluem este widget. Ausente na herança do DietFlow. */
  uso?: number
}) {
  const [dados, setDados] = useState<unknown>(() => def.dadosIniciais())

  const Componente = def.Componente as unknown as ComponentType<{
    dados: unknown
    onChange: (d: unknown) => void
  }>
  const Icone = def.icone

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-colors',
        aberto && 'border-foreground/15',
      )}
    >
      {/* Cabeçalho em colunas: nome e descrição à esquerda, o estado atual do
          widget sempre na mesma coluna à direita. É o alinhamento dessa coluna
          que faz a lista parecer uma lista, e não cartões avulsos. */}
      <button
        type="button"
        onClick={onAlternar}
        className={cn(
          'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 text-left',
          'transition-colors hover:bg-muted/40',
          aberto && 'bg-muted/30',
        )}
      >
        <Icone className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-tight">{def.nome}</span>
          <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
            {def.descricao}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {uso !== undefined && (
            <Badge
              variant={uso > 0 ? 'secondary' : 'outline'}
              className="hidden shrink-0 font-normal sm:inline-flex"
            >
              {uso > 0 ? `em ${uso} protocolo${uso > 1 ? 's' : ''}` : 'em nenhum protocolo'}
            </Badge>
          )}
          <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:block">
            {def.resumo(dados as never)}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              aberto && 'rotate-180',
            )}
          />
        </span>
      </button>

      {aberto && (
        <div className="border-t bg-muted/15 px-5 py-4">
          <Componente dados={dados} onChange={setDados} />
        </div>
      )}
    </div>
  )
}
