import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { capacidade as api } from '@/servicos/casos'
import { ROTULO_CLASSE, type SlotClass } from '@shared/clinical/caso'
import { COR_CLASSE } from './GradeSemanal'

/**
 * Como cada consultório funciona — uma vez, para sempre.
 *
 * A regra é semanal: que dias abre, de que hora a que hora, com que pausas e
 * oferecendo que tamanhos de vaga. As vagas da agenda são materializadas disso.
 * Mudar a quarta muda todas as quartas adiante — ninguém volta aqui toda semana
 * para repetir a mesma frase.
 *
 * A barra é o desenho do expediente: arrastar o meio move o dia inteiro, as
 * pontas esticam, e a pausa é um pedaço tirado de dentro.
 */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORA_INICIO = 6
const HORA_FIM = 22
const TOTAL = (HORA_FIM - HORA_INICIO) * 60
const PASSO = 15

type Pausa = { id: string; inicio: number; fim: number }
type Dia = { weekday: number; ativo: boolean; inicio: number; fim: number; pausas: Pausa[] }
type Disponibilidade = {
  resourceId: string
  nome: string
  ativo: boolean
  mistura: SlotClass[]
  dias: Dia[]
  vagasFuturas: number
}

const CLASSES: SlotClass[] = ['QUICK', 'STANDARD', 'EXTENDED']

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function pct(min: number): number {
  return ((min - HORA_INICIO * 60) / TOTAL) * 100
}
function snap(min: number): number {
  return Math.round(min / PASSO) * PASSO
}

export function ModalDisponibilidade({
  aberto,
  onFechar,
  onMudou,
}: {
  aberto: boolean
  onFechar: () => void
  onMudou: () => void
}) {
  const [lista, setLista] = useState<Disponibilidade[]>([])
  const [atual, setAtual] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const d = (await api.disponibilidade()) as Disponibilidade[]
      setLista(d)
      setAtual((a) => a ?? d[0]?.resourceId ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) void recarregar()
  }, [aberto, recarregar])

  const consultorio = lista.find((l) => l.resourceId === atual) ?? null

  function alterar(mudanca: (d: Disponibilidade) => Disponibilidade) {
    setLista((atuais) =>
      atuais.map((l) => (l.resourceId === atual ? mudanca(l) : l)),
    )
  }

  function alterarDia(weekday: number, mudanca: (d: Dia) => Dia) {
    alterar((c) => ({
      ...c,
      dias: c.dias.map((d) => (d.weekday === weekday ? mudanca(d) : d)),
    }))
  }

  async function salvar() {
    if (!consultorio) return
    setSalvando(true)
    try {
      const r = await api.salvarDisponibilidade({
        resourceId: consultorio.resourceId,
        mistura: consultorio.mistura,
        dias: consultorio.dias,
      })
      toast.success(
        `${consultorio.nome}: ${r.criadas} vagas abertas${r.removidas > 0 ? `, ${r.removidas} fechadas` : ''}.`,
      )
      await recarregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-3xl" data-testid="modal-disponibilidade">
        <DialogHeader>
          <DialogTitle>Disponibilidade</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {lista.map((c) => (
                <button
                  key={c.resourceId}
                  type="button"
                  aria-pressed={c.resourceId === atual}
                  onClick={() => setAtual(c.resourceId)}
                  data-testid="aba-consultorio"
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12px] transition-colors',
                    c.resourceId === atual ? 'bg-accent font-medium' : 'text-muted-foreground',
                  )}
                >
                  {c.nome}
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    {c.vagasFuturas}
                  </span>
                </button>
              ))}
            </div>

            {consultorio && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Oferece</span>
                  {CLASSES.map((k) => {
                    const on = consultorio.mistura.includes(k)
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        data-testid={`mix-${k}`}
                        onClick={() =>
                          alterar((c) => ({
                            ...c,
                            mistura: on
                              ? c.mistura.filter((x) => x !== k)
                              : [...c.mistura, k],
                          }))
                        }
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                          on ? 'bg-accent' : 'text-muted-foreground/60',
                        )}
                      >
                        <span className={cn('size-2 rounded-full', COR_CLASSE[k])} aria-hidden />
                        {ROTULO_CLASSE[k]}
                      </button>
                    )
                  })}
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="flex border-b bg-muted/30 pl-[5.5rem]">
                    {Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => (
                      <span
                        key={i}
                        className="flex-1 py-1 text-center font-mono text-[9px] text-muted-foreground"
                      >
                        {HORA_INICIO + i}
                      </span>
                    ))}
                  </div>

                  {consultorio.dias.map((dia) => (
                    <LinhaDia
                      key={dia.weekday}
                      dia={dia}
                      onAlterar={(m) => alterarDia(dia.weekday, m)}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vale para as próximas 8 semanas. Vaga com consulta marcada não é mexida.
                  </p>
                  <Button onClick={salvar} disabled={salvando} data-testid="salvar-disponibilidade">
                    {salvando && <Loader2 className="size-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Um dia da semana: switch, barra do expediente e as pausas dentro dela. */
function LinhaDia({ dia, onAlterar }: { dia: Dia; onAlterar: (m: (d: Dia) => Dia) => void }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [arrasto, setArrasto] = useState<
    | { tipo: 'mover' | 'inicio' | 'fim'; base: number }
    | { tipo: 'pausa-inicio' | 'pausa-fim' | 'pausa-mover'; id: string; base: number }
    | null
  >(null)

  function minutosDoEvento(e: React.MouseEvent | MouseEvent): number {
    const caixa = trilho.current?.getBoundingClientRect()
    if (!caixa) return 0
    const razao = Math.min(Math.max((e.clientX - caixa.left) / caixa.width, 0), 1)
    return snap(HORA_INICIO * 60 + razao * TOTAL)
  }

  useEffect(() => {
    if (!arrasto) return

    function aoMover(e: MouseEvent) {
      const m = minutosDoEvento(e)
      onAlterar((d) => {
        if (arrasto!.tipo === 'inicio') return { ...d, inicio: Math.min(m, d.fim - PASSO) }
        if (arrasto!.tipo === 'fim') return { ...d, fim: Math.max(m, d.inicio + PASSO) }
        if (arrasto!.tipo === 'mover') {
          const largura = d.fim - d.inicio
          const inicio = Math.min(Math.max(m - arrasto!.base, HORA_INICIO * 60), HORA_FIM * 60 - largura)
          const desloca = inicio - d.inicio
          return {
            ...d,
            inicio,
            fim: inicio + largura,
            pausas: d.pausas.map((p) => ({ ...p, inicio: p.inicio + desloca, fim: p.fim + desloca })),
          }
        }
        const id = (arrasto as { id: string }).id
        return {
          ...d,
          pausas: d.pausas.map((p) => {
            if (p.id !== id) return p
            if (arrasto!.tipo === 'pausa-inicio') {
              return { ...p, inicio: Math.min(Math.max(m, d.inicio), p.fim - PASSO) }
            }
            if (arrasto!.tipo === 'pausa-fim') {
              return { ...p, fim: Math.max(Math.min(m, d.fim), p.inicio + PASSO) }
            }
            const largura = p.fim - p.inicio
            const inicio = Math.min(Math.max(m - arrasto!.base, d.inicio), d.fim - largura)
            return { ...p, inicio, fim: inicio + largura }
          }),
        }
      })
    }

    function aoSoltar() {
      setArrasto(null)
    }

    window.addEventListener('mousemove', aoMover)
    window.addEventListener('mouseup', aoSoltar)
    return () => {
      window.removeEventListener('mousemove', aoMover)
      window.removeEventListener('mouseup', aoSoltar)
    }
  }, [arrasto, onAlterar])

  return (
    <div className="flex items-center gap-2 border-b px-2 py-1.5 last:border-0" data-testid="linha-dia">
      <div className="flex w-[5rem] shrink-0 items-center gap-2">
        <Switch
          checked={dia.ativo}
          aria-label={DIAS[dia.weekday]}
          onCheckedChange={(v) => onAlterar((d) => ({ ...d, ativo: v }))}
        />
        <span className={cn('text-[12px]', !dia.ativo && 'text-muted-foreground/50')}>
          {DIAS[dia.weekday]}
        </span>
      </div>

      <div
        ref={trilho}
        className={cn(
          'relative h-8 flex-1 select-none rounded-md bg-muted/40',
          !dia.ativo && 'opacity-40',
        )}
      >
        {dia.ativo && (
          <div
            className="absolute inset-y-1 flex cursor-grab items-center rounded bg-primary/20 ring-1 ring-primary/40"
            style={{ left: `${pct(dia.inicio)}%`, width: `${((dia.fim - dia.inicio) / TOTAL) * 100}%` }}
            data-testid="barra-expediente"
            onMouseDown={(e) => {
              e.preventDefault()
              setArrasto({ tipo: 'mover', base: minutosDoEvento(e) - dia.inicio })
            }}
          >
            <span
              className="absolute -left-0.5 h-full w-2 cursor-ew-resize rounded-l bg-primary/60"
              data-testid="handle-inicio"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setArrasto({ tipo: 'inicio', base: 0 })
              }}
            />
            <span
              className="absolute -right-0.5 h-full w-2 cursor-ew-resize rounded-r bg-primary/60"
              data-testid="handle-fim"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setArrasto({ tipo: 'fim', base: 0 })
              }}
            />

            {dia.pausas.map((p) => (
              <div
                key={p.id}
                className="absolute inset-y-0 flex cursor-grab items-center justify-center rounded bg-background ring-1 ring-border"
                style={{
                  left: `${((p.inicio - dia.inicio) / (dia.fim - dia.inicio)) * 100}%`,
                  width: `${((p.fim - p.inicio) / (dia.fim - dia.inicio)) * 100}%`,
                }}
                data-testid="barra-pausa"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setArrasto({ tipo: 'pausa-mover', id: p.id, base: minutosDoEvento(e) - p.inicio })
                }}
              >
                <span
                  className="absolute -left-0.5 h-full w-1.5 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setArrasto({ tipo: 'pausa-inicio', id: p.id, base: 0 })
                  }}
                />
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-destructive"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() =>
                    onAlterar((d) => ({ ...d, pausas: d.pausas.filter((x) => x.id !== p.id) }))
                  }
                  aria-label="Remover pausa"
                >
                  <X className="size-3" />
                </button>
                <span
                  className="absolute -right-0.5 h-full w-1.5 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setArrasto({ tipo: 'pausa-fim', id: p.id, base: 0 })
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex w-[8rem] shrink-0 items-center justify-end gap-1">
        {dia.ativo ? (
          <>
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {hhmm(dia.inicio)}–{hhmm(dia.fim)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0"
              aria-label={`Adicionar pausa ${DIAS[dia.weekday]}`}
              onClick={() =>
                onAlterar((d) => {
                  const meio = snap(d.inicio + (d.fim - d.inicio) / 2)
                  return {
                    ...d,
                    pausas: [
                      ...d.pausas,
                      { id: `p${d.pausas.length}-${meio}`, inicio: meio, fim: Math.min(meio + 60, d.fim) },
                    ],
                  }
                })
              }
            >
              <Plus className="size-3.5" />
            </Button>
          </>
        ) : (
          <span className="text-[10.5px] text-muted-foreground/50">fechado</span>
        )}
      </div>
    </div>
  )
}
