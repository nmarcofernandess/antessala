import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListFilter,
  Search,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import {
  CASOS,
  CLASSES,
  ESTADOS,
  VAGAS_DO_DIA,
  emMinutos,
  type Caso,
  type EstadoCaso,
} from '@/vitrine/dados'
import { CarimboSintetico, Inicial, Rotulo, SeloClasse, TituloTela } from '@/vitrine/pecas'

const ABRE = emMinutos('08:00')
const FECHA = emMinutos('16:00')
const PX_POR_MIN = 1.9
/** Abaixo desta altura a vaga não comporta duas linhas e colapsa em uma só. */
const ALTURA_MINIMA_DUAS_LINHAS = 52

/**
 * S06 / S07 — Agenda e fila operacional.
 *
 * Duas leituras do mesmo dia: a grade, onde a vaga tem tamanho proporcional
 * à duração, e a lista de pessoas, onde a recepção trabalha por caso.
 */
export function AgendaPagina() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Agenda' }]} />

      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <TituloTela
          rotulo="Recepção · S06 e S07"
          titulo="Agenda pré-anestésica"
          apoio="Quinta-feira, 14 de agosto de 2026. A altura de cada vaga é a duração que a entrevista definiu — não uma grade fixa de trinta minutos."
          acao={
            <>
              <CarimboSintetico />
              <div className="flex items-center rounded-lg border">
                <Button variant="ghost" size="icon" className="rounded-r-none">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="border-x px-3 py-1.5 font-mono text-xs tabular-nums">14 ago</span>
                <Button variant="ghost" size="icon" className="rounded-l-none">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </>
          }
        />

        <Tabs defaultValue="agenda" className="mt-6">
          <TabsList>
            <TabsTrigger value="agenda">
              <CalendarDays className="size-4" /> Agenda do dia
            </TabsTrigger>
            <TabsTrigger value="pessoas">
              <Users className="size-4" /> Pessoas
              <Badge variant="secondary" className="ml-1.5 font-mono text-[10px] tabular-nums">
                {CASOS.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="mt-6">
            <Grade />
          </TabsContent>

          <TabsContent value="pessoas" className="mt-6">
            <ListaPessoas />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ══════════════ ABA 1 — grade do dia ══════════════ */

function Grade() {
  const horas = useMemo(() => {
    const out: number[] = []
    for (let m = ABRE; m <= FECHA; m += 60) out.push(m)
    return out
  }, [])

  const ocupadas = VAGAS_DO_DIA.filter((v) => v.casoId)
  const minutosUsados = ocupadas.reduce((s, v) => s + CLASSES[v.classe].minutos + CLASSES[v.classe].buffer, 0)
  const capacidade = FECHA - ABRE

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <Rotulo>Consultório 3 · Dra. Helena Vasques</Rotulo>
          <div className="flex items-center gap-3">
            {(['RAPIDA', 'NORMAL', 'ESTENDIDA'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', CLASSES[k].ponto)} aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {CLASSES[k].nome}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="relative px-5 py-5" style={{ height: (FECHA - ABRE) * PX_POR_MIN + 40 }}>
          {/* réguas de hora */}
          {horas.map((m) => (
            <div
              key={m}
              className="absolute left-0 right-0 flex items-center gap-3 px-5"
              style={{ top: (m - ABRE) * PX_POR_MIN + 20 }}
            >
              <span className="w-10 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          ))}

          {/* vagas */}
          {VAGAS_DO_DIA.map((v) => {
            const c = CLASSES[v.classe]
            const caso = CASOS.find((x) => x.id === v.casoId)
            const top = (emMinutos(v.inicio) - ABRE) * PX_POR_MIN + 20
            const alturaTotal = (c.minutos + c.buffer) * PX_POR_MIN
            const alturaConsulta = c.minutos * PX_POR_MIN
            const compacto = alturaConsulta < ALTURA_MINIMA_DUAS_LINHAS

            return (
              <div
                key={v.id}
                className="absolute left-[76px] right-5"
                style={{ top, height: alturaTotal }}
              >
                <div
                  className={cn(
                    'flex h-full flex-col overflow-hidden rounded-lg border',
                    caso ? c.tom : 'border-dashed bg-muted/20',
                  )}
                >
                  <div
                    className="flex min-h-0 flex-1 items-start gap-3 px-3.5 py-2"
                    style={{ height: alturaConsulta }}
                  >
                    {caso ? (
                      <>
                        <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums">
                          {v.inicio}
                        </span>
                        <span
                          className={cn(
                            'min-w-0 flex-1',
                            compacto && 'flex items-baseline gap-2 truncate',
                          )}
                        >
                          <span className="block shrink-0 truncate text-[13px] font-medium text-foreground">
                            {caso.nome}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {caso.procedimento}
                            {caso.recurso && ` · ${caso.recurso}`}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider opacity-80">
                          {c.minutos} min
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {v.inicio}
                        </span>
                        <span className="flex-1 text-[12px] text-muted-foreground">
                          Vaga {c.nome.toLowerCase()} livre · {c.minutos} min
                        </span>
                      </>
                    )}
                  </div>
                  {/* faixa de buffer, listrada */}
                  <div
                    className="shrink-0 border-t border-dashed opacity-50"
                    style={{
                      height: c.buffer * PX_POR_MIN,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 6px)',
                    }}
                    title={`${c.buffer} min de registro`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border bg-card p-5">
          <Rotulo>Ocupação do dia</Rotulo>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-light tabular-nums">
              {Math.round((minutosUsados / capacidade) * 100)}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${(minutosUsados / capacidade) * 100}%` }}
            />
          </div>
          <p className="mt-3 font-mono text-[11px] tabular-nums text-muted-foreground">
            {minutosUsados} de {capacidade} min
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <Rotulo>Vagas por classe</Rotulo>
          <div className="mt-3 space-y-2.5">
            {(['RAPIDA', 'NORMAL', 'ESTENDIDA'] as const).map((k) => {
              const total = VAGAS_DO_DIA.filter((v) => v.classe === k).length
              const livres = VAGAS_DO_DIA.filter((v) => v.classe === k && !v.casoId).length
              return (
                <div key={k} className="flex items-baseline gap-2 text-xs">
                  <span className={cn('size-1.5 shrink-0 rounded-full', CLASSES[k].ponto)} aria-hidden />
                  <span className="flex-1">{CLASSES[k].nome}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {total - livres}/{total}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-dashed p-5">
          <Rotulo>Regra de reserva</Rotulo>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Vaga menor nunca atende requisito maior. Duas reservas simultâneas na mesma vaga:
            uma vence, a outra recebe erro recuperável.
          </p>
        </div>
      </aside>
    </div>
  )
}

/* ══════════════ ABA 2 — pessoas ══════════════ */

const FILTROS: { id: 'todos' | EstadoCaso; nome: string }[] = [
  { id: 'todos', nome: 'Todos' },
  { id: 'AGUARDA_ENFERMAGEM', nome: 'Aguardam entrevista' },
  { id: 'PRONTO_PARA_AGENDAR', nome: 'Para agendar' },
  { id: 'AGENDADO', nome: 'Agendados' },
  { id: 'PENDENCIA', nome: 'Com pendência' },
]

function ListaPessoas() {
  const [filtro, setFiltro] = useState<'todos' | EstadoCaso>('todos')
  const [busca, setBusca] = useState('')

  const lista = CASOS.filter(
    (c) =>
      (filtro === 'todos' || c.estado === filtro) &&
      (c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.procedimento.toLowerCase().includes(busca.toLowerCase()) ||
        c.codigo.toLowerCase().includes(busca.toLowerCase())),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, procedimento ou código do caso"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTROS.map((f) => {
            const n = f.id === 'todos' ? CASOS.length : CASOS.filter((c) => c.estado === f.id).length
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                  filtro === f.id
                    ? 'border-foreground/20 bg-foreground text-background'
                    : 'hover:bg-accent',
                )}
              >
                {f.nome}
                <span className="font-mono tabular-nums opacity-60">{n}</span>
              </button>
            )
          })}
        </div>
        <Button variant="outline" size="icon" title="Mais filtros">
          <Filter className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-2.5">
          <ListFilter className="size-3.5 text-muted-foreground" />
          <Rotulo>
            {lista.length} {lista.length === 1 ? 'caso' : 'casos'}
          </Rotulo>
        </div>

        {lista.length === 0 && (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">
            Nenhum caso com esse filtro.
          </p>
        )}

        <div className="divide-y">
          {lista.map((c) => (
            <LinhaPessoa key={c.id} caso={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LinhaPessoa({ caso }: { caso: Caso }) {
  const est = ESTADOS[caso.estado]
  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40">
      <Inicial nome={caso.nome} />

      <div className="min-w-0 flex-[2]">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{caso.nome}</span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {caso.idade}a
          </span>
        </div>
        <span className="block truncate text-xs text-muted-foreground">{caso.procedimento}</span>
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <span className="block truncate text-xs">{caso.servico}</span>
        <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
          {caso.codigo}
        </span>
      </div>

      <div className="hidden w-36 shrink-0 lg:block">
        <span className={cn('block text-xs font-medium', est.tom)}>{est.nome}</span>
        <span className="block font-mono text-[10.5px] text-muted-foreground">
          {caso.atualizadoEm}
        </span>
      </div>

      <div className="flex w-[190px] shrink-0 items-center justify-end gap-2">
        {caso.horario && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {caso.horario}
          </span>
        )}
        {caso.classe ? (
          <SeloClasse classe={caso.classe} compacto />
        ) : (
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground/60">
            sem requisito
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        Abrir
      </Button>
    </div>
  )
}
