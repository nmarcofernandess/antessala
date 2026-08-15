import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { capacidade as api } from '@/servicos/casos'
import { ROTULO_CLASSE, type SlotClass } from '@shared/clinical/caso'
import { COR_CLASSE } from './GradeSemanal'

/**
 * Como cada consultório funciona — uma vez, para sempre.
 *
 * Duas regras vivem aqui, e só elas. **Quando** a sala atende: dias, horário e
 * pausas, desenhados em barra. E **quanto do dia** pertence a cada tipo de
 * consulta: a reserva, em porcentagem, arrastada numa barra só.
 *
 * Nenhum horário é criado aqui. O expediente é um intervalo; a consulta é
 * encaixada nele na hora de marcar. A reserva existe para o caso longo não
 * perder o dia para uma fila de casos curtos.
 *
 * Mexer numa quarta muda todas as quartas adiante — ninguém volta aqui toda
 * semana repetir a mesma frase.
 */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORA_INICIO = 6
const HORA_FIM = 22
const TOTAL = (HORA_FIM - HORA_INICIO) * 60
const PASSO = 15

/** Minutos que cada consulta ocupa a sala, buffer incluído. */
const OCUPACAO: Record<SlotClass, number> = { QUICK: 25, STANDARD: 40, EXTENDED: 60 }
const CLASSES: SlotClass[] = ['QUICK', 'STANDARD', 'EXTENDED']

type Pausa = { id: string; inicio: number; fim: number }
type Dia = { weekday: number; ativo: boolean; inicio: number; fim: number; pausas: Pausa[] }
type Cotas = Record<SlotClass, number>
type Disponibilidade = {
  resourceId: string
  nome: string
  ativo: boolean
  capabilities: string[]
  cotas: Cotas
  dias: Dia[]
  consultasFuturas: number
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function pct(min: number): number {
  return ((min - HORA_INICIO * 60) / TOTAL) * 100
}
function snap(min: number): number {
  return Math.round(min / PASSO) * PASSO
}

/** Minutos de atendimento de um dia — expediente menos as pausas. */
function minutosUteis(d: Dia): number {
  if (!d.ativo) return 0
  const pausado = d.pausas.reduce((t, p) => t + Math.max(p.fim - p.inicio, 0), 0)
  return Math.max(d.fim - d.inicio - pausado, 0)
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
    setLista((atuais) => atuais.map((l) => (l.resourceId === atual ? mudanca(l) : l)))
  }

  function alterarDia(weekday: number, mudanca: (d: Dia) => Dia) {
    alterar((c) => ({ ...c, dias: c.dias.map((d) => (d.weekday === weekday ? mudanca(d) : d)) }))
  }

  async function salvar() {
    if (!consultorio) return
    setSalvando(true)
    try {
      await api.salvarDisponibilidade({
        resourceId: consultorio.resourceId,
        cotas: consultorio.cotas,
        dias: consultorio.dias,
      })
      toast.success(`${consultorio.nome} atualizado.`)
      await recarregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  // A média de minutos por dia útil traduz porcentagem em consultas — que é o
  // que a operação de fato pergunta ("cabem quantas rápidas?").
  const diasAbertos = consultorio?.dias.filter((d) => d.ativo) ?? []
  const mediaMinutos = diasAbertos.length
    ? Math.round(diasAbertos.reduce((t, d) => t + minutosUteis(d), 0) / diasAbertos.length)
    : 0

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
                </button>
              ))}
            </div>

            {consultorio && (
              <>
                <BarraDeCotas
                  cotas={consultorio.cotas}
                  minutosPorDia={mediaMinutos}
                  onAlterar={(cotas) => alterar((c) => ({ ...c, cotas }))}
                />

                <div className="overflow-hidden rounded-lg border">
                  <div className="flex border-b bg-muted/30 pl-[5.5rem] pr-[7rem]">
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
                      onReplicar={() =>
                        alterar((c) => ({
                          ...c,
                          dias: c.dias.map((d) =>
                            d.weekday >= 1 && d.weekday <= 5
                              ? { ...dia, weekday: d.weekday, pausas: dia.pausas.map((p) => ({ ...p })) }
                              : d,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vale de agora em diante. Consulta marcada não é mexida.
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

/**
 * A reserva do dia numa barra só.
 *
 * Arrastar a divisória entre duas cores move tempo de um tipo para o outro; o
 * total é sempre 100% porque a barra é o dia. Três campos de porcentagem
 * separados deixariam somar 90 ou 130 — a barra não deixa a pergunta errada
 * existir.
 */
function BarraDeCotas({
  cotas,
  minutosPorDia,
  onAlterar,
}: {
  cotas: Cotas
  minutosPorDia: number
  onAlterar: (c: Cotas) => void
}) {
  const trilho = useRef<HTMLDivElement>(null)
  const [arrastando, setArrastando] = useState<0 | 1 | null>(null)

  useEffect(() => {
    if (arrastando === null) return

    function aoMover(e: MouseEvent) {
      const caixa = trilho.current?.getBoundingClientRect()
      if (!caixa) return
      const posicao = Math.min(Math.max(((e.clientX - caixa.left) / caixa.width) * 100, 0), 100)
      const alvo = Math.round(posicao / 5) * 5

      // As divisórias são cortes acumulados: a primeira separa rápida de normal,
      // a segunda separa normal de estendida. Cada uma só empurra as vizinhas.
      const corte1 = arrastando === 0 ? alvo : cotas.QUICK
      const corte2 = arrastando === 1 ? alvo : cotas.QUICK + cotas.STANDARD
      const a = Math.min(corte1, corte2)
      const b = Math.max(corte1, corte2)
      onAlterar({ QUICK: a, STANDARD: b - a, EXTENDED: 100 - b })
    }

    function aoSoltar() {
      setArrastando(null)
    }

    window.addEventListener('mousemove', aoMover)
    window.addEventListener('mouseup', aoSoltar)
    return () => {
      window.removeEventListener('mousemove', aoMover)
      window.removeEventListener('mouseup', aoSoltar)
    }
  }, [arrastando, cotas, onAlterar])

  const cortes = [cotas.QUICK, cotas.QUICK + cotas.STANDARD]

  return (
    <div className="space-y-1.5" data-testid="barra-cotas">
      <div
        ref={trilho}
        className="relative flex h-9 select-none overflow-hidden rounded-md border"
      >
        {CLASSES.map((k) => (
          <div
            key={k}
            className={cn(
              'flex items-center justify-center overflow-hidden text-[10px] font-medium text-white/90',
              COR_CLASSE[k],
            )}
            style={{ width: `${cotas[k]}%` }}
            data-testid={`cota-${k}`}
          >
            {cotas[k] >= 15 && `${cotas[k]}%`}
          </div>
        ))}

        {cortes.slice(0, 2).map((corte, i) => (
          <span
            key={i}
            role="separator"
            aria-label={`Divisória ${i + 1}`}
            className="absolute inset-y-0 -ml-1.5 w-3 cursor-ew-resize"
            style={{ left: `${corte}%` }}
            data-testid={`divisoria-${i}`}
            onMouseDown={(e) => {
              e.preventDefault()
              setArrastando(i as 0 | 1)
            }}
          >
            <span className="mx-auto block h-full w-0.5 bg-background/70" />
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {CLASSES.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('size-2 rounded-full', COR_CLASSE[k])} aria-hidden />
            {ROTULO_CLASSE[k]}
            <span className="font-mono tabular-nums">{cotas[k]}%</span>
            {minutosPorDia > 0 && (
              <span className="text-muted-foreground/60">
                ≈ {Math.floor((minutosPorDia * cotas[k]) / 100 / OCUPACAO[k])}/dia
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Um dia da semana: switch, barra do expediente e as pausas dentro dela.
 *
 * A barra responde ao mouse — arrastar o meio move o dia, as pontas esticam. E
 * clicar nela abre o que dá para fazer ali: pausa, horário exato, replicar.
 * Botão solto do lado de fora obrigava a mirar num alvo que não é o assunto.
 */
function LinhaDia({
  dia,
  onAlterar,
  onReplicar,
}: {
  dia: Dia
  onAlterar: (m: (d: Dia) => Dia) => void
  onReplicar: () => void
}) {
  const trilho = useRef<HTMLDivElement>(null)
  const [arrasto, setArrasto] = useState<
    | { tipo: 'mover' | 'inicio' | 'fim'; base: number }
    | { tipo: 'pausa-inicio' | 'pausa-fim' | 'pausa-mover'; id: string; base: number }
    | null
  >(null)
  const [popover, setPopover] = useState(false)

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
          const inicio = Math.min(
            Math.max(m - arrasto!.base, HORA_INICIO * 60),
            HORA_FIM * 60 - largura,
          )
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

  function adicionarPausa() {
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
          <Popover open={popover} onOpenChange={setPopover}>
            <PopoverTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Expediente ${DIAS[dia.weekday]}`}
                className="absolute inset-y-1 cursor-grab rounded bg-primary/20 ring-1 ring-primary/40"
                style={{
                  left: `${pct(dia.inicio)}%`,
                  width: `${((dia.fim - dia.inicio) / TOTAL) * 100}%`,
                }}
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
                    className="absolute inset-y-0 cursor-grab rounded bg-background ring-1 ring-border"
                    style={{
                      left: `${((p.inicio - dia.inicio) / (dia.fim - dia.inicio)) * 100}%`,
                      width: `${((p.fim - p.inicio) / (dia.fim - dia.inicio)) * 100}%`,
                    }}
                    data-testid="barra-pausa"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setArrasto({
                        tipo: 'pausa-mover',
                        id: p.id,
                        base: minutosDoEvento(e) - p.inicio,
                      })
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
            </PopoverTrigger>

            <PopoverContent align="center" className="w-64 space-y-2 p-3">
              <p className="font-mono text-[12px] tabular-nums">
                {hhmm(dia.inicio)}–{hhmm(dia.fim)}
              </p>

              {dia.pausas.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    pausa {hhmm(p.inicio)}–{hhmm(p.fim)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label={`Remover pausa ${hhmm(p.inicio)}`}
                    onClick={() =>
                      onAlterar((d) => ({ ...d, pausas: d.pausas.filter((x) => x.id !== p.id) }))
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 text-[11px]"
                  onClick={adicionarPausa}
                >
                  Pausa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 flex-1 text-[11px]"
                  onClick={() => {
                    onReplicar()
                    setPopover(false)
                  }}
                >
                  Seg–Sex
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex w-[6.5rem] shrink-0 justify-end">
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {dia.ativo ? `${hhmm(dia.inicio)}–${hhmm(dia.fim)}` : 'fechado'}
        </span>
      </div>
    </div>
  )
}
