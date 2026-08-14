import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Search, Users } from 'lucide-react'
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
const PX_POR_MIN = 1.6
/** Largura da régua de horas e respiro até a faixa das vagas. */
const COL_HORA = 52
const GAP_HORA = 12
/** Abaixo desta altura a vaga não comporta duas linhas e colapsa em uma só. */
const ALTURA_MINIMA_DUAS_LINHAS = 52
/** Vão sem vaga menor que isto não vale um rótulo — vira só respiro. */
const VAO_MINIMO_ROTULADO = 25

/** Minutos desde a meia-noite de volta para "HH:MM". */
function emRelogio(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Duração legível: "45 min", "1 h", "1 h 15". */
function emDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

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

  /**
   * Vãos entre uma vaga e a seguinte. Sem eles a grade tem buracos mudos e
   * parece quebrada; rotulados, o vazio vira informação — não há vaga ali.
   */
  const vaos = useMemo(() => {
    const ordenadas = [...VAGAS_DO_DIA].sort((a, b) => emMinutos(a.inicio) - emMinutos(b.inicio))
    const out: { inicio: number; fim: number }[] = []
    let cursor = ABRE
    for (const v of ordenadas) {
      const inicio = emMinutos(v.inicio)
      if (inicio - cursor >= VAO_MINIMO_ROTULADO) out.push({ inicio: cursor, fim: inicio })
      cursor = Math.max(cursor, inicio + CLASSES[v.classe].minutos + CLASSES[v.classe].buffer)
    }
    if (FECHA - cursor >= VAO_MINIMO_ROTULADO) out.push({ inicio: cursor, fim: FECHA })
    return out
  }, [])

  const ocupadas = VAGAS_DO_DIA.filter((v) => v.casoId)
  const minutosUsados = ocupadas.reduce(
    (s, v) => s + CLASSES[v.classe].minutos + CLASSES[v.classe].buffer,
    0,
  )
  const capacidade = FECHA - ABRE
  const ocupacao = Math.round((minutosUsados / capacidade) * 100)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px]">
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-3.5">
          <Rotulo>Consultório 3 · Dra. Helena Vasques</Rotulo>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {emRelogio(ABRE)} – {emRelogio(FECHA)}
          </span>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="relative" style={{ height: (FECHA - ABRE) * PX_POR_MIN }}>
            {/* réguas de hora — a hora e a linha nascem no mesmo eixo */}
            {horas.map((m) => (
              <div
                key={m}
                className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
                style={{ top: (m - ABRE) * PX_POR_MIN, gap: GAP_HORA }}
              >
                <span
                  className="shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground"
                  style={{ width: COL_HORA }}
                >
                  {emRelogio(m)}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
            ))}

            {/* vãos sem vaga */}
            {vaos.map((v) => (
              <div
                key={v.inicio}
                className="pointer-events-none absolute right-0 flex items-center justify-center"
                style={{
                  top: (v.inicio - ABRE) * PX_POR_MIN,
                  height: (v.fim - v.inicio) * PX_POR_MIN,
                  left: COL_HORA + GAP_HORA,
                }}
              >
                <span className="rounded bg-card px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                  sem vaga · {emDuracao(v.fim - v.inicio)}
                </span>
              </div>
            ))}

            {/* vagas */}
            {VAGAS_DO_DIA.map((v) => {
              const c = CLASSES[v.classe]
              const caso = CASOS.find((x) => x.id === v.casoId)
              const alturaConsulta = c.minutos * PX_POR_MIN
              const compacto = alturaConsulta < ALTURA_MINIMA_DUAS_LINHAS

              return (
                <div
                  key={v.id}
                  className="absolute right-0"
                  style={{
                    top: (emMinutos(v.inicio) - ABRE) * PX_POR_MIN,
                    height: (c.minutos + c.buffer) * PX_POR_MIN,
                    left: COL_HORA + GAP_HORA,
                  }}
                >
                  <div
                    className={cn(
                      'flex h-full flex-col overflow-hidden rounded-lg border',
                      caso ? c.tom : 'border-dashed bg-muted/20 text-muted-foreground',
                    )}
                  >
                    {/* consulta — três colunas iguais em toda vaga, cheia ou livre */}
                    <div
                      className="grid min-h-0 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5"
                      style={{ height: alturaConsulta }}
                    >
                      <span
                        className={cn(
                          'font-mono text-[11px] tabular-nums',
                          caso ? 'font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {v.inicio}
                      </span>

                      {caso ? (
                        <span className={cn('min-w-0', compacto && 'flex items-baseline gap-2')}>
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {caso.nome}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {caso.procedimento}
                            {caso.recurso && ` · ${caso.recurso}`}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-[12px] text-muted-foreground">
                          Vaga {c.nome.toLowerCase()} livre
                        </span>
                      )}

                      <span
                        className={cn(
                          'shrink-0 font-mono text-[10px] uppercase tracking-wider tabular-nums',
                          caso ? 'opacity-80' : 'text-muted-foreground',
                        )}
                      >
                        {c.minutos} min
                      </span>
                    </div>

                    {/* faixa de buffer, listrada */}
                    <div
                      className={cn(
                        'shrink-0 border-t border-dashed',
                        caso ? 'opacity-45' : 'text-muted-foreground/25',
                      )}
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
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border bg-card p-5">
          <Rotulo>Ocupação do dia</Rotulo>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-light leading-none tabular-nums">
              {ocupacao}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${ocupacao}%` }}
            />
          </div>
          <p className="mt-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            {minutosUsados} de {capacidade} min
          </p>
        </div>

        {/* Este cartão também é a legenda da grade: cor, duração e ocupação. */}
        <div className="rounded-xl border bg-card p-5">
          <Rotulo>Vagas por classe</Rotulo>
          <div className="mt-3">
            {(['RAPIDA', 'NORMAL', 'ESTENDIDA'] as const).map((k) => {
              const total = VAGAS_DO_DIA.filter((v) => v.classe === k).length
              const livres = VAGAS_DO_DIA.filter((v) => v.classe === k && !v.casoId).length
              return (
                <div
                  key={k}
                  className="grid grid-cols-[minmax(0,1fr)_auto_38px] items-baseline gap-x-3 border-t py-2 text-xs first:border-t-0 first:pt-0"
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn('size-1.5 shrink-0 translate-y-[-1px] rounded-full', CLASSES[k].ponto)}
                      aria-hidden
                    />
                    {CLASSES[k].nome}
                  </span>
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {CLASSES[k].minutos} + {CLASSES[k].buffer} min
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums">
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
            Vaga menor nunca atende requisito maior. Duas reservas simultâneas na mesma vaga: uma
            vence, a outra recebe erro recuperável.
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

/**
 * Uma única definição de colunas para o cabeçalho e para todas as linhas —
 * é o que faz a tabela alinhar de verdade, com conteúdo de qualquer largura.
 */
const COLUNAS = cn(
  'grid items-center gap-x-4',
  'grid-cols-[minmax(0,1fr)_52px_112px_76px]',
  'md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_52px_112px_76px]',
  'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_148px_52px_112px_76px]',
)

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
        {/* cabeçalho de colunas: a mesma grade das linhas */}
        <div className={cn(COLUNAS, 'border-b bg-muted/30 px-5 py-2.5')}>
          <Rotulo>Pessoa</Rotulo>
          <Rotulo className="hidden md:block">Serviço</Rotulo>
          <Rotulo className="hidden lg:block">Estado</Rotulo>
          <Rotulo className="col-span-2">Vaga</Rotulo>
          <span aria-hidden />
        </div>

        {lista.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">
            Nenhum caso com esse filtro.
          </p>
        ) : (
          <div className="divide-y">
            {lista.map((c) => (
              <LinhaPessoa key={c.id} caso={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LinhaPessoa({ caso }: { caso: Caso }) {
  const est = ESTADOS[caso.estado]
  return (
    <div className={cn(COLUNAS, 'group px-5 py-3 transition-colors hover:bg-accent/40')}>
      <div className="flex min-w-0 items-center gap-3">
        <Inicial nome={caso.nome} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{caso.nome}</span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {caso.idade}a
            </span>
          </div>
          <span className="block truncate text-xs text-muted-foreground">{caso.procedimento}</span>
        </div>
      </div>

      <div className="hidden min-w-0 md:block">
        <span className="block truncate text-xs">{caso.servico}</span>
        <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
          {caso.codigo}
        </span>
      </div>

      <div className="hidden min-w-0 lg:block">
        <span className={cn('block truncate text-xs font-medium', est.tom)}>{est.nome}</span>
        <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
          {caso.atualizadoEm}
        </span>
      </div>

      <span
        className={cn(
          'text-right font-mono text-xs tabular-nums',
          caso.horario ? 'text-foreground' : 'text-muted-foreground/40',
        )}
      >
        {caso.horario ?? '—'}
      </span>

      <div className="min-w-0">
        {caso.classe ? (
          <SeloClasse classe={caso.classe} compacto />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
            sem requisito
          </span>
        )}
      </div>

      {/* Sempre presente e sempre do mesmo tamanho: hover muda cor, nunca altura. */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground/70 transition-colors group-hover:text-foreground"
        >
          Abrir
        </Button>
      </div>
    </div>
  )
}
