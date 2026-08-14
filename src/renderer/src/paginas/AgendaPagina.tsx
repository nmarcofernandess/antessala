import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core'
import { CalendarClock, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Rotulo } from '@/vitrine/pecas'
import { agenda as api, novaChave } from '@/servicos/casos'
import {
  ROTULO_CLASSE,
  type AgendaRangeDTO,
  type SlotClass,
  type SlotDTO,
} from '@shared/clinical/caso'

/**
 * Agenda da consulta pré-anestésica.
 *
 * O FullCalendar é **projeção e coletor de intenção**: ele desenha o que o
 * processo principal devolveu e envia "quero esta vaga" ou "movi para aqui".
 * Toda validação vive no main — vaga livre, classe compatível, caso no estado
 * certo. Quando o comando falha, `revert()` desfaz o gesto na hora: o calendário
 * nunca fica mostrando um agendamento que não existe no banco.
 *
 * Nada aqui agenda cirurgia. A sala cirúrgica continua externa ao produto.
 */

type ItemDaFila = {
  caseId: string
  displayCode: string
  personName: string
  procedureDescription: string
  requirementId: string
  slotClass: SlotClass
  durationMinutes: number
  operationalExplanation: string[]
  requiredCapabilities: string[]
  readySince: string
}

const COR_CLASSE: Record<SlotClass, { fundo: string; borda: string; texto: string }> = {
  QUICK: { fundo: 'rgba(34,197,94,0.16)', borda: 'rgb(34,197,94)', texto: 'inherit' },
  STANDARD: { fundo: 'rgba(59,130,246,0.16)', borda: 'rgb(59,130,246)', texto: 'inherit' },
  EXTENDED: { fundo: 'rgba(245,158,11,0.18)', borda: 'rgb(245,158,11)', texto: 'inherit' },
}

function inicioDaSemana(d = new Date()): Date {
  const base = new Date(d)
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - base.getDay())
  return base
}

export function AgendaPagina() {
  const [intervalo, setIntervalo] = useState<AgendaRangeDTO>({ resources: [], slots: [] })
  const [fila, setFila] = useState<ItemDaFila[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState('calendario')

  const [selecionado, setSelecionado] = useState<ItemDaFila | null>(null)
  const [vagas, setVagas] = useState<SlotDTO[]>([])
  const [buscandoVagas, setBuscandoVagas] = useState(false)
  const [reservando, setReservando] = useState<string | null>(null)

  // Depois de marcar, o calendário vai até o dia da consulta: quem reservou
  // precisa ver onde a consulta caiu, e ela raramente cai na semana em que se
  // estava olhando.
  const [irPara, setIrPara] = useState<string | null>(null)
  const calendario = useRef<FullCalendar | null>(null)

  const [cancelando, setCancelando] = useState<{ id: string; version: number } | null>(null)
  const [motivo, setMotivo] = useState('')

  const janela = useRef({
    de: inicioDaSemana().toISOString(),
    ate: new Date(inicioDaSemana().getTime() + 7 * 86_400_000).toISOString(),
  })

  const recarregar = useCallback(async () => {
    try {
      const [faixa, listaFila] = await Promise.all([
        api.intervalo(janela.current.de, janela.current.ate),
        api.fila(),
      ])
      setIntervalo(faixa)
      setFila(listaFila as ItemDaFila[])
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    if (!irPara || aba !== 'calendario' || !calendario.current) return
    calendario.current.getApi().gotoDate(irPara)
    setIrPara(null)
  }, [irPara, aba])

  /** Eventos do calendário: reserva é evento sólido, vaga livre é fundo. */
  const eventos = useMemo(() => {
    return intervalo.slots.map((slot) => {
      const cor = COR_CLASSE[slot.slotClass]
      if (slot.booking) {
        return {
          id: slot.booking.id,
          title: `${slot.booking.personName} · ${slot.booking.displayCode}`,
          start: slot.booking.startsAt,
          end: slot.booking.endsAt,
          backgroundColor: cor.fundo,
          borderColor: cor.borda,
          textColor: 'inherit',
          editable: slot.booking.status === 'CONFIRMED',
          extendedProps: {
            tipo: 'booking' as const,
            slotId: slot.id,
            slotClass: slot.slotClass,
            resourceName: slot.resourceName,
            booking: slot.booking,
          },
        }
      }
      return {
        id: slot.id,
        title: `${ROTULO_CLASSE[slot.slotClass]} livre · ${slot.resourceName}`,
        start: slot.startsAt,
        end: slot.endsAt,
        display: 'background' as const,
        backgroundColor: cor.fundo,
        extendedProps: { tipo: 'slot' as const, slotClass: slot.slotClass },
      }
    })
  }, [intervalo])

  async function abrirDrawer(item: ItemDaFila) {
    setSelecionado(item)
    setBuscandoVagas(true)
    try {
      const compativeis = await api.vagasCompativeis({ requirementId: item.requirementId })
      setVagas(compativeis)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      setVagas([])
    } finally {
      setBuscandoVagas(false)
    }
  }

  async function reservar(slot: SlotDTO) {
    if (!selecionado) return
    setReservando(slot.id)
    try {
      const booking = await api.reservar({
        caseId: selecionado.caseId,
        requirementId: selecionado.requirementId,
        slotId: slot.id,
        idempotencyKey: novaChave(),
      })
      toast.success(
        `Consulta de ${booking.personName} marcada para ${new Date(booking.startsAt).toLocaleString('pt-BR')}.`,
      )
      setSelecionado(null)
      setAba('calendario')
      setIrPara(booking.startsAt)
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      await abrirDrawer(selecionado)
    } finally {
      setReservando(null)
    }
  }

  /**
   * Arrastar é intenção, não decisão.
   *
   * O gesto vira comando; se o main recusar — vaga ocupada, classe errada,
   * versão velha — `revert()` devolve o evento ao lugar de origem e o motivo
   * aparece em texto. O desenho nunca fica mentindo sobre o banco.
   */
  async function aoSoltar(info: EventDropArg) {
    const destino = intervalo.slots.find(
      (s) => Date.parse(s.startsAt) === info.event.start!.getTime() && !s.booking,
    )
    const booking = info.oldEvent.extendedProps.booking as { id: string; version: number } | undefined

    if (!destino || !booking) {
      info.revert()
      toast.error('Solte a consulta sobre uma vaga livre.')
      return
    }

    try {
      await api.mover({
        bookingId: booking.id,
        slotId: destino.id,
        expectedVersion: booking.version,
      })
      toast.success('Consulta remarcada.')
      await recarregar()
    } catch (e) {
      info.revert()
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return
    try {
      await api.cancelar({
        bookingId: cancelando.id,
        motivo,
        expectedVersion: cancelando.version,
      })
      toast.success('Consulta cancelada. O caso voltou para a fila de agendamento.')
      setCancelando(null)
      setMotivo('')
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const reservas = intervalo.slots.filter((s) => s.booking).map((s) => s.booking!)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Agenda' }]} />

      <div className="border-b px-4 py-2">
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="calendario">
              <CalendarClock className="size-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="fila">
              <Users className="size-4" /> Para agendar
              {fila.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 tabular-nums">
                  {fila.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {carregando ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando a agenda…
        </div>
      ) : erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{erro}</p>
          <Button variant="outline" size="sm" onClick={() => void recarregar()}>
            Tentar de novo
          </Button>
        </div>
      ) : aba === 'calendario' ? (
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          <div className="antessala-calendario">
            <FullCalendar
              ref={calendario}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              buttonText={{
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                list: 'Programação',
              }}
              locale="pt-br"
              firstDay={0}
              allDaySlot={false}
              slotMinTime="07:30:00"
              slotMaxTime="18:00:00"
              nowIndicator
              height="auto"
              expandRows
              editable
              eventDurationEditable={false}
              events={eventos}
              eventDrop={aoSoltar}
              datesSet={(info) => {
                janela.current = {
                  de: info.start.toISOString(),
                  ate: info.end.toISOString(),
                }
                void recarregar()
              }}
              eventClick={(info) => {
                const props = info.event.extendedProps as {
                  tipo?: string
                  booking?: { id: string; version: number; caseId: string }
                }
                if (props.tipo !== 'booking' || !props.booking) return
                setCancelando({ id: props.booking.id, version: props.booking.version })
              }}
            />
          </div>

          {/* Equivalente acessível: a mesma agenda em lista, sem depender de arrastar. */}
          <section className="mt-8" data-testid="agenda-lista">
            <Rotulo>Consultas marcadas no período</Rotulo>
            {reservas.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma consulta pré-anestésica marcada nesta semana.
              </p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-normal">Horário</th>
                    <th className="pb-2 font-normal">Pessoa</th>
                    <th className="pb-2 font-normal">Caso</th>
                    <th className="pb-2 font-normal">Consultório</th>
                    <th className="pb-2 font-normal">Vaga</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas
                    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                    .map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs tabular-nums">
                          {new Date(b.startsAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2">{b.personName}</td>
                        <td className="py-2">
                          <Link
                            to={`/casos/${b.caseId}`}
                            className="font-mono text-xs underline underline-offset-2"
                          >
                            {b.displayCode}
                          </Link>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{b.resourceName}</td>
                        <td className="py-2">
                          <Badge variant="outline">{ROTULO_CLASSE[b.slotClass]}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-4xl p-6 lg:p-8" data-testid="fila-para-agendar">
            <Rotulo>Casos com requisito publicado</Rotulo>
            <p className="mb-5 mt-1 text-xs text-muted-foreground">
              A recepção vê o tamanho da vaga e o que a sala precisa ter — nunca o achado clínico
              que produziu esse tamanho.
            </p>

            {fila.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum caso esperando vaga. Eles aparecem aqui quando a enfermagem confirma o
                requisito.
              </p>
            ) : (
              <div className="space-y-2">
                {fila.map((item) => (
                  <div
                    key={item.caseId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {item.displayCode}
                        </span>
                        <Badge variant="outline">{ROTULO_CLASSE[item.slotClass]}</Badge>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {item.durationMinutes} min
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium">{item.personName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.procedureDescription}
                      </p>
                      {item.requiredCapabilities.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          A sala precisa de: {item.requiredCapabilities.join(', ').toLowerCase()}
                        </p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => abrirDrawer(item)}>
                      Escolher vaga
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* ── drawer de vagas ── */}
      <Sheet open={selecionado !== null} onOpenChange={(a) => !a && setSelecionado(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-5 py-4">
            <SheetTitle>Vagas compatíveis</SheetTitle>
            <SheetDescription>
              {selecionado
                ? `${selecionado.personName} · ${ROTULO_CLASSE[selecionado.slotClass]} de ${selecionado.durationMinutes} min`
                : ''}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 p-3">
              {buscandoVagas && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline size-4 animate-spin" /> Procurando vagas…
                </p>
              )}
              {!buscandoVagas && vagas.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma vaga desta classe está livre no período gerado.
                </p>
              )}
              {vagas.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={reservando !== null}
                  onClick={() => reservar(slot)}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                    'border-transparent hover:border-border hover:bg-muted/50 disabled:opacity-50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {new Date(slot.startsAt).toLocaleString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{slot.resourceName}</p>
                  </div>
                  {reservando === slot.id ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      {ROTULO_CLASSE[slot.slotClass]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── cancelamento ── */}
      <Sheet open={cancelando !== null} onOpenChange={(a) => !a && setCancelando(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-5 py-4">
            <SheetTitle>Cancelar esta consulta</SheetTitle>
            <SheetDescription>
              O caso volta para a fila de agendamento. Cancelar a consulta não cancela o caso.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-5">
            <Textarea
              rows={4}
              value={motivo}
              placeholder="Motivo do cancelamento (mínimo 10 caracteres)"
              onChange={(e) => setMotivo(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={motivo.trim().length < 10}
              onClick={confirmarCancelamento}
            >
              Cancelar consulta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
