import { useState, type ComponentType } from 'react'
import { ChevronDown } from 'lucide-react'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { Rotulo, TituloTela } from '@/vitrine/pecas'
import { WIDGETS_DIETFLOW, type DefWidgetDietFlow } from '@/vitrine/widgets/registroDietFlow'

/**
 * Repertório de widgets herdado do DietFlow.
 *
 * A tela existe para mostrar de onde vem o vocabulário do composer. Os widgets
 * são nutricionais, não pré-anestésicos — o que se transporta é a forma de
 * perguntar: uma escala que se lê de relance, um score que se explica sozinho,
 * uma meta que aparece ao lado do valor em vez de num manual.
 *
 * Oito cartões idênticos em fila não têm ritmo: a lista é agrupada pela
 * natureza da resposta, que é o que de fato muda de um widget para o outro.
 */

const GRUPOS: { rotulo: string; nota: string; tipos: string[] }[] = [
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
const GRUPOS_MONTADOS = (() => {
  const montados = GRUPOS.map((g) => ({
    ...g,
    itens: WIDGETS_DIETFLOW.filter((w) => g.tipos.includes(w.tipo)),
  }))
  const cobertos = new Set(GRUPOS.flatMap((g) => g.tipos))
  const restantes = WIDGETS_DIETFLOW.filter((w) => !cobertos.has(w.tipo))
  if (restantes.length) montados[montados.length - 1].itens.push(...restantes)
  return montados.filter((g) => g.itens.length > 0)
})()

export function RepertorioPagina() {
  const [abertos, setAbertos] = useState<string[]>(['sono', 'bristol'])

  const alternar = (tipo: string) =>
    setAbertos((a) => (a.includes(tipo) ? a.filter((x) => x !== tipo) : [...a, tipo]))

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Repertório de widgets' }]} />

      <div className="mx-auto w-full max-w-4xl p-6 lg:p-8">
        <TituloTela
          rotulo="Composer · herança"
          titulo="Repertório do DietFlow"
          apoio="Os oito widgets do composer clínico do DietFlow, com respostas reais de uma consulta nutricional. É daqui que vem a gramática usada na anamnese pré-anestésica: escala que se lê de relance, score que se explica sozinho, meta ao lado do valor."
        />

        <div className="mt-8 space-y-8">
          {GRUPOS_MONTADOS.map((g) => (
            <section key={g.rotulo}>
              {/* Sem contagem ao lado do rótulo: em versalete monoespaçado o
                  número gruda na etiqueta e é lido como parte do nome. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
                <Rotulo>{g.rotulo}</Rotulo>
                <span className="text-[11.5px] text-muted-foreground">{g.nota}</span>
              </div>

              <div className="mt-3 space-y-2">
                {g.itens.map((w) => (
                  <CartaoRepertorio
                    key={w.tipo}
                    def={w}
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
      </div>
    </div>
  )
}

function CartaoRepertorio({
  def,
  aberto,
  onAlternar,
}: {
  def: DefWidgetDietFlow
  aberto: boolean
  onAlternar: () => void
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
          que faz a lista parecer uma lista, e não oito cartões avulsos. */}
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
          <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
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

export { Rotulo }
