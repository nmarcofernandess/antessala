import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { EtiquetaSecao, Metrica, ValorHero } from '@/vitrine/primitivos'
import { CarimboSintetico, Inicial, LinhaDado, Rotulo, TituloTela } from '@/vitrine/pecas'
import { agenda, casos } from '@/servicos/casos'
import {
  ROTULO_CLASSE,
  ROTULO_STATUS,
  type AgendaIntervaloDTO,
  type CaseStatus,
  type CaseSummaryDTO,
  type SlotClass,
} from '@shared/clinical/caso'

/**
 * S01 — Painel do dia.
 *
 * Três perguntas na ordem em que a recepção as faz de manhã: onde cada
 * encaminhamento parou, quanto do dia já foi consumido e qual vaga ainda pode
 * ser oferecida.
 *
 * Tudo vem do banco. Não há fixture alimentando esta tela: banco vazio mostra
 * banco vazio, com o caminho para o primeiro encaminhamento. O painel conta
 * casos, vagas e minutos — não atribui risco, ASA, aptidão nem conduta.
 */

/** O fluxo do produto, na ordem em que o caso caminha. Rota = onde se age nele. */
const FLUXO: { status: CaseStatus; rota: string }[] = [
  { status: 'WAITING_NURSING', rota: '/' },
  { status: 'NURSING_IN_PROGRESS', rota: '/' },
  { status: 'READY_FOR_SCHEDULING', rota: '/agenda' },
  { status: 'SCHEDULED', rota: '/agenda' },
  { status: 'WAITING_ANESTHESIA', rota: '/agenda' },
  { status: 'IN_ASSESSMENT', rota: '/agenda' },
  { status: 'PENDING', rota: '/agenda' },
  { status: 'READY_FOR_HANDOFF', rota: '/agenda' },
  { status: 'DELIVERED_TO_REQUESTER', rota: '/arquivados' },
]

const CLASSES_DO_DIA: SlotClass[] = ['QUICK', 'STANDARD', 'EXTENDED']

const TOM_CLASSE: Record<SlotClass, { ponto: string; texto: string }> = {
  QUICK: { ponto: 'bg-success', texto: 'text-success' },
  STANDARD: { ponto: 'bg-primary', texto: 'text-primary' },
  EXTENDED: { ponto: 'bg-warning', texto: 'text-warning' },
}

const DURACAO: Record<SlotClass, number> = { QUICK: 20, STANDARD: 35, EXTENDED: 50 }

function limitesDeHoje(): { de: string; ate: string } {
  const de = new Date()
  de.setHours(0, 0, 0, 0)
  const ate = new Date(de)
  ate.setDate(ate.getDate() + 1)
  return { de: de.toISOString(), ate: ate.toISOString() }
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function Dashboard() {
  const [lista, setLista] = useState<CaseSummaryDTO[]>([])
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [dia, setDia] = useState<AgendaIntervaloDTO>({ resources: [], dias: [] })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { de, ate } = limitesDeHoje()
    try {
      const [casosDoDia, contagem, agendaDoDia] = await Promise.all([
        casos.listar({ limite: 100 }),
        casos.contagens(),
        agenda.intervalo(de, ate),
      ])
      setLista(casosDoDia)
      setContagens(contagem)
      setDia(agendaDoDia)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // O dia não tem vaga contada: tem tempo. Consultas marcadas, minutos livres e
  // quantas ainda cabem de cada tamanho — que é o que o main calcula da regra.
  const consultas = dia.dias.flatMap((d) =>
    d.consultas.filter((c) => c.status !== 'CANCELLED' && c.status !== 'NO_SHOW'),
  )
  const minutosLivres = dia.dias.reduce((t, d) => t + d.minutosLivres, 0)
  const minutosDoDia = dia.dias.reduce((t, d) => t + d.minutosDeAtendimento, 0)
  const cabem: Record<SlotClass, number> = CLASSES_DO_DIA.reduce(
    (acc, k) => ({ ...acc, [k]: dia.dias.reduce((t, d) => t + d.capacidade[k], 0) }),
    { QUICK: 0, STANDARD: 0, EXTENDED: 0 },
  )
  const buracos = dia.dias
    .flatMap((d) =>
      d.livres.map((l) => ({
        resourceName: d.resourceName,
        inicio: l.inicio,
        minutos: Math.round(
          (new Date(l.fim).getTime() - new Date(l.inicio).getTime()) / 60_000,
        ),
      })),
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  const comVaga = useMemo(
    () =>
      lista
        .filter((c) => c.booking)
        .sort((a, b) => a.booking!.startsAt.localeCompare(b.booking!.startsAt)),
    [lista],
  )
  const semVaga = useMemo(
    () =>
      lista.filter(
        (c) => !c.booking && !['DELIVERED_TO_REQUESTER', 'CANCELLED'].includes(c.status),
      ),
    [lista],
  )

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando o painel…
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Início' }]} />

      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <TituloTela
          rotulo={`Recepção · ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          titulo="Painel do dia"
          apoio="O que a recepção precisa ver ao abrir o sistema: onde cada encaminhamento parou, quanto do dia já foi ocupado e quais vagas ainda podem ser oferecidas."
          acao={
            <>
              {/* O banco é real, o hospital não: o carimbo impede que o painel
                  seja lido como quadro de uma unidade em operação. */}
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

        {erro && (
          <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {erro}
          </p>
        )}

        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-4">
            <Rotulo>Fluxo do dia</Rotulo>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {lista.length} {lista.length === 1 ? 'encaminhamento' : 'encaminhamentos'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-7">
            {FLUXO.map(({ status, rota }) => {
              const n = contagens[status] ?? 0
              return (
                <Link
                  key={status}
                  to={rota}
                  className="flex flex-col gap-1.5 bg-card px-4 py-4 transition-colors hover:bg-accent/50"
                >
                  <span
                    className={cn(
                      'font-mono text-[30px] font-light leading-none tabular-nums',
                      n === 0 && 'text-muted-foreground/40',
                    )}
                  >
                    {n}
                  </span>
                  <span className="text-[11.5px] leading-tight text-muted-foreground">
                    {ROTULO_STATUS[status]}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-start">
          {/* ── fila ── */}
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

            {lista.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
                <p className="text-sm font-medium">Nenhum encaminhamento registrado</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Cada encaminhamento abre um caso autônomo. Comece registrando o primeiro papel
                  que chegou na recepção.
                </p>
                <Button asChild size="sm">
                  <Link to="/casos/novo">
                    <ClipboardPlus className="size-4" />
                    Registrar encaminhamento
                  </Link>
                </Button>
              </div>
            ) : (
              <>
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
              </>
            )}
          </section>

          <aside className="space-y-4">
            <ValorHero
              valor={consultas.length}
              unidade={consultas.length === 1 ? 'consulta hoje' : 'consultas hoje'}
              metricas={<Metrica valor={minutosLivres} rotulo="min livres" />}
            >
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="bg-primary"
                  style={{
                    width: `${minutosDoDia > 0 ? ((minutosDoDia - minutosLivres) / minutosDoDia) * 100 : 0}%`,
                  }}
                  aria-hidden
                />
              </div>

              <div className="mt-3.5 space-y-2">
                {CLASSES_DO_DIA.map((k) => (
                  <div key={k} className="flex items-baseline gap-2 text-xs">
                    <span
                      className={cn('size-1.5 shrink-0 rounded-full', TOM_CLASSE[k].ponto)}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{ROTULO_CLASSE[k]}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      cabem {cabem[k]}
                    </span>
                  </div>
                ))}
              </div>
            </ValorHero>

            <RegraDeTempo />
          </aside>
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <Rotulo>Espaços livres hoje</Rotulo>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {minutosLivres} de {minutosDoDia} min
            </span>
          </div>

          {buracos.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
              Nada livre hoje.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-px overflow-hidden rounded-xl border bg-border">
              {buracos.slice(0, 12).map((b) => (
                <Link
                  key={`${b.resourceName}|${b.inicio}`}
                  to="/agenda"
                  className="flex min-w-[120px] flex-1 flex-col items-start gap-2 bg-card px-4 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[19px] font-light leading-none tabular-nums">
                      {hora(b.inicio)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {b.minutos} min
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {b.resourceName}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 border-t pt-5">
          <p className="max-w-[92ch] text-xs leading-relaxed text-muted-foreground">
            O painel conta casos, vagas e minutos. Não atribui risco, ASA, aptidão nem conduta: o
            requisito de agenda é sugerido pela entrevista e confirmado por uma pessoa antes de
            virar vaga. Cada encaminhamento é autônomo — nada aqui junta pessoas ou histórico. A
            agenda é da consulta pré-anestésica; a cirurgia continua fora deste sistema. O
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

function GrupoFila({ rotulo, total }: { rotulo: string; total: number }) {
  return (
    <div className="flex items-baseline gap-2 border-y bg-muted/40 px-5 py-1.5">
      <EtiquetaSecao>{rotulo}</EtiquetaSecao>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">{total}</span>
    </div>
  )
}

/** O horário é a espinha da linha; sem ele, a coluna fica vazia em vez de mentir. */
function LinhaCaso({ caso }: { caso: CaseSummaryDTO }) {
  return (
    <Link
      to={`/casos/${caso.id}`}
      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40"
    >
      <span className="w-11 shrink-0 font-mono text-[12.5px] tabular-nums">
        {caso.booking ? hora(caso.booking.startsAt) : <span className="text-muted-foreground/30">—</span>}
      </span>

      <Inicial nome={caso.personName} className="size-8" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-medium leading-tight">{caso.personName}</span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {caso.personAge}a
          </span>
        </div>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {caso.procedureDescription} · {caso.serviceName}
        </span>
      </div>

      <div className="hidden w-36 shrink-0 md:block">
        <span className="block truncate text-[11.5px] font-medium">
          {ROTULO_STATUS[caso.status]}
        </span>
        <span className="block font-mono text-[10.5px] text-muted-foreground">
          {caso.displayCode}
        </span>
      </div>

      {caso.requirement ? (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider',
            TOM_CLASSE[caso.requirement.slotClass].texto,
          )}
        >
          <span
            className={cn('size-1.5 rounded-full', TOM_CLASSE[caso.requirement.slotClass].ponto)}
            aria-hidden
          />
          {ROTULO_CLASSE[caso.requirement.slotClass]}
        </span>
      ) : (
        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground/60">
          sem requisito
        </span>
      )}
    </Link>
  )
}

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
        {CLASSES_DO_DIA.map((classe) => (
          <div key={classe} className="flex items-baseline gap-2 text-xs">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', TOM_CLASSE[classe].ponto)}
              aria-hidden
            />
            <span className="flex-1 truncate">{ROTULO_CLASSE[classe]}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {DURACAO[classe]} min
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-[11px] leading-relaxed text-muted-foreground">
        Cálculo acima de 50 min não vira vaga automaticamente: volta para decisão humana.
      </p>
    </div>
  )
}
