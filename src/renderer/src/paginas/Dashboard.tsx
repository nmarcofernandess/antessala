import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import {
  CASOS,
  CLASSES,
  ESTADOS,
  VAGAS_DO_DIA,
  emMinutos,
  type Caso,
  type ClasseVaga,
  type EstadoCaso,
} from '@/vitrine/dados'
import { EtiquetaSecao, Metrica, ValorHero } from '@/vitrine/primitivos'
import {
  CarimboSintetico,
  Inicial,
  LinhaDado,
  Rotulo,
  SeloClasse,
  TituloTela,
} from '@/vitrine/pecas'

/** O fluxo do produto, na ordem em que o caso caminha. Rota = onde se age nele. */
const FLUXO: { estado: EstadoCaso; rota: string }[] = [
  { estado: 'AGUARDA_ENFERMAGEM', rota: '/triagem' },
  { estado: 'EM_ENTREVISTA', rota: '/triagem' },
  { estado: 'PRONTO_PARA_AGENDAR', rota: '/agenda' },
  { estado: 'AGENDADO', rota: '/agenda' },
  { estado: 'EM_AVALIACAO', rota: '/agenda' },
  { estado: 'PENDENCIA', rota: '/agenda' },
  { estado: 'CONCLUIDO', rota: '/agenda' },
]

/** Fora da faixa não é vaga do dia: nenhuma agenda a oferece. */
const CLASSES_DO_DIA = ['RAPIDA', 'NORMAL', 'ESTENDIDA'] as const

/** A escala inteira do dimensionamento, incluindo o degrau que não vira vaga. */
const FAIXAS: { classe: ClasseVaga; limite: string }[] = [
  { classe: 'RAPIDA', limite: `${CLASSES.RAPIDA.minutos} min` },
  { classe: 'NORMAL', limite: `até ${CLASSES.NORMAL.minutos} min` },
  { classe: 'ESTENDIDA', limite: `até ${CLASSES.ESTENDIDA.minutos} min` },
  { classe: 'FORA_DA_FAIXA', limite: `acima de ${CLASSES.ESTENDIDA.minutos} min` },
]

const posicaoNoFluxo = (e: EstadoCaso) => FLUXO.findIndex((f) => f.estado === e)
const contar = (e: EstadoCaso) => CASOS.filter((c) => c.estado === e).length

const vagasLivres = VAGAS_DO_DIA.filter((v) => !v.casoId)
const vagasOcupadas = VAGAS_DO_DIA.length - vagasLivres.length
const minutosLivres = vagasLivres.reduce((s, v) => s + CLASSES[v.classe].minutos, 0)

const comVaga = CASOS.filter((c): c is Caso & { horario: string } => Boolean(c.horario)).sort(
  (a, b) => emMinutos(a.horario) - emMinutos(b.horario),
)
// O caso concluído saiu do dia: ele conta no fluxo, mas não é fila de trabalho.
const semVaga = CASOS.filter((c) => !c.horario && c.estado !== 'CONCLUIDO').sort(
  (a, b) => posicaoNoFluxo(a.estado) - posicaoNoFluxo(b.estado),
)

/**
 * S01 — Painel do dia.
 *
 * A tela responde três perguntas na ordem em que a recepção as faz de manhã:
 * onde cada encaminhamento parou, quanto do dia já foi consumido e qual vaga
 * ainda pode ser oferecida. Tudo é contagem sobre os casos e as vagas — o
 * painel não atribui risco, aptidão nem conduta.
 */
export function Dashboard() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Início' }]} />

      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <TituloTela
          rotulo="Recepção · 14 de agosto de 2026"
          titulo="Painel do dia"
          apoio="O que a recepção precisa ver ao abrir o sistema: onde cada encaminhamento parou, quanto do dia já foi ocupado e quais vagas ainda podem ser oferecidas."
          acao={
            <>
              <CarimboSintetico />
              <Button asChild size="sm">
                <Link to="/casos/novo">
                  <ClipboardPlus className="size-4" />
                  Novo encaminhamento
                </Link>
              </Button>
            </>
          }
        />

        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-4">
            <Rotulo>Fluxo do dia</Rotulo>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {CASOS.length} encaminhamentos
            </span>
          </div>
          <Fluxo />
        </section>

        {/* `items-start` impede que a fila estique até a altura da coluna vizinha. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-start">
          <FilaDoDia />

          <aside className="space-y-4">
            <Ocupacao />
            <RegraDeTempo />
          </aside>
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <Rotulo>Vagas livres hoje</Rotulo>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {vagasLivres.length} de {VAGAS_DO_DIA.length}
            </span>
          </div>
          <VagasLivres />
        </section>

        <div className="mt-8 border-t pt-5">
          <p className="max-w-[92ch] text-xs leading-relaxed text-muted-foreground">
            O painel conta casos, vagas e minutos. Não atribui risco, ASA, aptidão nem conduta: o
            requisito de agenda é sugerido pela entrevista e confirmado por uma pessoa antes de
            virar vaga. Cada encaminhamento é autônomo — nada aqui junta pessoas ou histórico. O
            vocabulário dos widgets vem do{' '}
            <Link to="/repertorio/widgets" className="text-foreground underline underline-offset-2">
              repertório do DietFlow
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════ fluxo do dia ══════════════ */

/**
 * Os sete estados em uma faixa, na ordem do fluxo. A cor de cada número é a
 * mesma que o estado carrega no resto do app — é dado, não enfeite.
 *
 * As hairlines saem de `gap-px` sobre um fundo `bg-border`. Por isso a linha
 * precisa fechar exatamente: célula faltando vira retângulo cinza. São sempre
 * sete estados — o tipo `EstadoCaso` garante — então sete colunas ou uma só.
 */
function Fluxo() {
  return (
    <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-7">
      {FLUXO.map(({ estado, rota }) => {
        const n = contar(estado)
        const e = ESTADOS[estado]
        return (
          <Link
            key={estado}
            to={rota}
            className="flex flex-col gap-1.5 bg-card px-4 py-4 transition-colors hover:bg-accent/50"
          >
            <span
              className={cn(
                'font-mono text-[30px] font-light leading-none tabular-nums',
                n === 0 ? 'text-muted-foreground/40' : e.tom,
              )}
            >
              {n}
            </span>
            <span className="text-[11.5px] leading-tight text-muted-foreground">{e.nome}</span>
          </Link>
        )
      })}
    </div>
  )
}

/* ══════════════ fila ══════════════ */

function FilaDoDia() {
  return (
    <section
      data-testid="fila-do-dia"
      className="overflow-hidden rounded-xl border bg-card lg:col-span-2"
    >
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <Rotulo>Fila do dia</Rotulo>
        <Link
          to="/agenda"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver agenda
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <GrupoFila rotulo="Com vaga marcada" total={comVaga.length} />
      <div className="divide-y">
        {comVaga.map((c) => (
          <LinhaCaso key={c.id} caso={c} />
        ))}
      </div>

      <GrupoFila rotulo="Sem vaga marcada" total={semVaga.length} />
      <div className="divide-y">
        {semVaga.map((c) => (
          <LinhaCaso key={c.id} caso={c} />
        ))}
      </div>
    </section>
  )
}

function GrupoFila({ rotulo, total }: { rotulo: string; total: number }) {
  return (
    <div className="flex items-baseline gap-2 border-y bg-muted/40 px-5 py-1.5">
      <EtiquetaSecao>{rotulo}</EtiquetaSecao>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">{total}</span>
    </div>
  )
}

/** O horário é a espinha da linha; sem ele, a coluna fica vazia em vez de mentir. */
function LinhaCaso({ caso }: { caso: Caso }) {
  const estado = ESTADOS[caso.estado]
  return (
    <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40">
      <span className="w-11 shrink-0 font-mono text-[12.5px] tabular-nums">
        {caso.horario ?? <span className="text-muted-foreground/30">—</span>}
      </span>

      <Inicial nome={caso.nome} className="size-8" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-medium leading-tight">{caso.nome}</span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {caso.idade}a
          </span>
        </div>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {caso.procedimento} · {caso.servico}
        </span>
      </div>

      <div className="hidden w-32 shrink-0 md:block">
        <span className={cn('block truncate text-[11.5px] font-medium', estado.tom)}>
          {estado.nome}
        </span>
        <span className="block font-mono text-[10.5px] text-muted-foreground">
          {caso.atualizadoEm}
        </span>
      </div>

      {caso.classe ? (
        <SeloClasse classe={caso.classe} compacto />
      ) : (
        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground/60">
          sem requisito
        </span>
      )}
    </div>
  )
}

/* ══════════════ ocupação ══════════════ */

/**
 * Distribuição das vagas por classe em uma barra só: a largura de cada
 * segmento é quantas vagas daquela classe existem, a parte cheia é o que já
 * foi ocupado. Duas leituras no mesmo traço, sem biblioteca.
 */
function Ocupacao() {
  return (
    <ValorHero
      valor={vagasOcupadas}
      unidade={`de ${VAGAS_DO_DIA.length} vagas`}
      metricas={<Metrica valor={minutosLivres} rotulo="min livres" />}
    >
      <div className="flex h-2.5 gap-1">
        {CLASSES_DO_DIA.map((k) => {
          const total = VAGAS_DO_DIA.filter((v) => v.classe === k).length
          const ocupadas = VAGAS_DO_DIA.filter((v) => v.classe === k && v.casoId).length
          if (total === 0) return null
          return (
            <div
              key={k}
              className="flex overflow-hidden rounded-full bg-muted"
              style={{ width: `${(total / VAGAS_DO_DIA.length) * 100}%` }}
              title={`${CLASSES[k].nome}: ${ocupadas} de ${total} ocupadas`}
            >
              <span
                className={CLASSES[k].ponto}
                style={{ width: `${(ocupadas / total) * 100}%` }}
                aria-hidden
              />
              <span
                className={cn('opacity-25', CLASSES[k].ponto)}
                style={{ width: `${((total - ocupadas) / total) * 100}%` }}
                aria-hidden
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3.5 space-y-2">
        {CLASSES_DO_DIA.map((k) => {
          const total = VAGAS_DO_DIA.filter((v) => v.classe === k).length
          const livres = VAGAS_DO_DIA.filter((v) => v.classe === k && !v.casoId).length
          return (
            <div key={k} className="flex items-baseline gap-2 text-xs">
              <span className={cn('size-1.5 shrink-0 rounded-full', CLASSES[k].ponto)} aria-hidden />
              <span className="flex-1 truncate">{CLASSES[k].nome}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {livres} livre{livres === 1 ? '' : 's'} de {total}
              </span>
            </div>
          )
        })}
      </div>
    </ValorHero>
  )
}

/* ══════════════ vagas livres ══════════════ */

/**
 * O que a recepção ainda pode oferecer, em faixa — o eco da faixa de estados.
 * As colunas acompanham quantas vagas sobraram, para a linha fechar sempre.
 */
function VagasLivres() {
  if (vagasLivres.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
        Nenhuma vaga livre hoje.
      </p>
    )
  }

  return (
    <div
      className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:[grid-template-columns:repeat(var(--colunas),minmax(0,1fr))]"
      style={{ ['--colunas' as string]: vagasLivres.length }}
    >
      {vagasLivres.map((v) => (
        <Link
          key={v.id}
          to="/agenda"
          className="flex flex-col items-start gap-2 bg-card px-4 py-3.5 transition-colors hover:bg-accent/50"
        >
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[19px] font-light leading-none tabular-nums">
              {v.inicio}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {CLASSES[v.classe].minutos} min
            </span>
          </span>
          <SeloClasse classe={v.classe} compacto />
        </Link>
      ))}
    </div>
  )
}

/* ══════════════ regra ══════════════ */

/** A regra de dimensionamento, escrita como ela é aplicada. */
function RegraDeTempo() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Rotulo>Como o tempo é dimensionado</Rotulo>

      <div className="mt-3">
        <LinhaDado rotulo="Base da consulta" valor="20 min" destaque />
        <LinhaDado rotulo="Domínio com achado" detalhe="no máximo três" valor="+5 min" />
        <LinhaDado rotulo="Cinco ou mais medicações" valor="+5 min" />
        <LinhaDado rotulo="Três ou mais diagnósticos" valor="+5 min" />
        <LinhaDado rotulo="Acomodação necessária" detalhe="fora do teto" valor="+10 min" />
      </div>

      <div className="mt-4 space-y-2 border-t pt-3.5">
        {FAIXAS.map(({ classe, limite }) => (
          <div key={classe} className="flex items-baseline gap-2 text-xs">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', CLASSES[classe].ponto)}
              aria-hidden
            />
            <span className="flex-1 truncate">{CLASSES[classe].nome}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{limite}</span>
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-[11px] leading-relaxed text-muted-foreground">
        Fora da faixa não vira vaga: volta para decisão humana.
      </p>
    </div>
  )
}
