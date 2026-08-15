import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { agenda as api } from '@/servicos/casos'
import { ROTULO_CLASSE, type AgendaIntervaloDTO, type SlotClass } from '@shared/clinical/caso'
import { COR_CLASSE, GradeSemanal, diasDaSemana } from './agenda/GradeSemanal'
import { DiaEmpilhado, type BuracoDoDia, type ConsultaDoDia } from './agenda/DiaEmpilhado'
import { ModalAgendar, ModalQuemCabe, type CasoDaFila } from './agenda/ModalAgendar'
import { ModalDisponibilidade } from './agenda/ModalDisponibilidade'

/**
 * A agenda da consulta pré-anestésica.
 *
 * Duas leituras. A semana responde "onde ainda cabe alguém", em densidade de
 * tempo livre. O dia responde "o que acontece agora", empilhado numa coluna só —
 * três consultórios viram linhas seguidas, não colunas paralelas.
 *
 * Nada de vaga é criado em lugar nenhum: o expediente é regra, e o livre é o
 * que sobra dele depois do que já foi marcado. Quem define a regra é o modal de
 * Disponibilidade; esta tela só a lê.
 */

const CLASSES: SlotClass[] = ['QUICK', 'STANDARD', 'EXTENDED']

const VAZIO: AgendaIntervaloDTO = { resources: [], dias: [] }

export function AgendaPagina() {
  const navegar = useNavigate()

  const [referencia, setReferencia] = useState(() => new Date())
  const [diaAberto, setDiaAberto] = useState<Date | null>(null)
  const [intervalo, setIntervalo] = useState<AgendaIntervaloDTO>(VAZIO)
  const [fila, setFila] = useState<CasoDaFila[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [classe, setClasse] = useState<SlotClass | null>(null)
  const [disponibilidade, setDisponibilidade] = useState(false)

  const [agendando, setAgendando] = useState<CasoDaFila | null>(null)
  const [buracoEscolhido, setBuracoEscolhido] = useState<BuracoDoDia | null>(null)

  const semana = useMemo(() => diasDaSemana(referencia), [referencia])

  const recarregar = useCallback(async () => {
    try {
      const de = new Date(semana[0])
      const ate = new Date(semana[6])
      ate.setHours(23, 59, 59, 999)
      const [faixa, listaFila] = await Promise.all([
        api.intervalo(de.toISOString(), ate.toISOString()),
        api.fila(),
      ])
      setIntervalo(faixa)
      setFila(listaFila as CasoDaFila[])
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [semana])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  async function chegada(c: ConsultaDoDia) {
    try {
      await api.chegada({ bookingId: c.bookingId, expectedVersion: c.version })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
    await recarregar()
  }

  async function ausencia(c: ConsultaDoDia) {
    try {
      await api.ausencia({ bookingId: c.bookingId, expectedVersion: c.version })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
    await recarregar()
  }

  /** Marcou: a agenda vai até o dia da consulta e abre. */
  async function irParaConsulta(quando: string) {
    const dia = new Date(quando)
    setReferencia(dia)
    setDiaAberto(dia)
    await recarregar()
  }

  function mover(dias: number) {
    const proxima = new Date(referencia)
    proxima.setDate(proxima.getDate() + dias)
    setReferencia(proxima)
    setDiaAberto(null)
  }

  const diasDoDiaAberto = diaAberto
    ? intervalo.dias.filter((d) => d.data === chaveDoDia(diaAberto))
    : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Agenda' }]} />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-4 p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8" onClick={() => mover(-7)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReferencia(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => mover(7)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <span className="text-sm font-medium">
              {semana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} –{' '}
              {semana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {CLASSES.map((c) => {
                const on = classe === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    data-testid={`filtro-${c}`}
                    onClick={() => setClasse(on ? null : c)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      on ? 'bg-accent' : 'text-muted-foreground/60',
                    )}
                  >
                    <span className={cn('size-2 rounded-full', COR_CLASSE[c])} aria-hidden />
                    {ROTULO_CLASSE[c]}
                  </button>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisponibilidade(true)}
                data-testid="abrir-disponibilidade"
              >
                <Pencil className="size-3.5" /> Disponibilidade
              </Button>
            </div>
          </div>

          {carregando ? (
            <p className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </p>
          ) : erro ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <p className="text-sm text-muted-foreground">{erro}</p>
              <Button variant="outline" size="sm" onClick={() => void recarregar()}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <GradeSemanal
              semana={semana}
              dias={intervalo.dias}
              classe={classe}
              onAbrirDia={setDiaAberto}
            />
          )}

          {diaAberto && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  {diaAberto.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setDiaAberto(null)}>
                  Fechar
                </Button>
              </div>
              <DiaEmpilhado
                dias={diasDoDiaAberto}
                classe={classe}
                onChegada={chegada}
                onAusencia={ausencia}
                onAbrirCaso={(id) => navegar(`/casos/${id}`)}
                onUsarBuraco={setBuracoEscolhido}
              />
            </section>
          )}

          <section className="space-y-2" data-testid="fila-para-agendar">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Esperando vaga</h2>
              {fila.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {fila.length}
                </Badge>
              )}
            </div>

            {fila.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Ninguém esperando.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                {fila.map((c) => (
                  <div
                    key={c.caseId}
                    className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{c.personName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.procedureDescription}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ROTULO_CLASSE[c.slotClass]} · {c.durationMinutes} min
                      </Badge>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        data-testid="marcar-consulta"
                        onClick={() => setAgendando(c)}
                      >
                        Marcar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ModalAgendar
        caso={agendando}
        aberto={agendando !== null}
        onFechar={() => setAgendando(null)}
        onMarcado={irParaConsulta}
      />
      <ModalQuemCabe
        buraco={buracoEscolhido}
        fila={fila}
        aberto={buracoEscolhido !== null}
        onFechar={() => setBuracoEscolhido(null)}
        onMarcado={irParaConsulta}
      />

      <ModalDisponibilidade
        aberto={disponibilidade}
        onFechar={() => setDisponibilidade(false)}
        onMudou={recarregar}
      />
    </div>
  )
}

function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
