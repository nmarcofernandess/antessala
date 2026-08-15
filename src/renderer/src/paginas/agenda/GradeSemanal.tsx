import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { DiaDaAgendaDTO, SlotClass } from '@shared/clinical/caso'

/**
 * A semana como densidade, não como calendário.
 *
 * Uma clínica com três consultórios não tem três agendas paralelas — tem uma
 * quantidade de tempo livre por faixa de hora. Empilhar as salas lado a lado só
 * mostra que existem três colunas; o que a recepção precisa saber é *quanto
 * sobrou e o que ainda cabe*, e isso cabe numa célula.
 *
 * Não há vaga contada aqui porque não há vaga criada em lugar nenhum: o que a
 * célula mostra é minuto livre de verdade, calculado do expediente menos o que
 * já foi marcado.
 */

export const COR_CLASSE: Record<SlotClass, string> = {
  QUICK: 'bg-emerald-500',
  STANDARD: 'bg-blue-500',
  EXTENDED: 'bg-amber-500',
}

export const SIGLA_CLASSE: Record<SlotClass, string> = {
  QUICK: 'R',
  STANDARD: 'N',
  EXTENDED: 'E',
}

/** Minutos que cada consulta ocupa a sala, buffer incluído. */
export const OCUPACAO: Record<SlotClass, number> = { QUICK: 25, STANDARD: 40, EXTENDED: 60 }

function mesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export function diasDaSemana(referencia: Date): Date[] {
  const inicio = new Date(referencia)
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    return d
  })
}

/** Quantos minutos deste intervalo caem dentro da hora cheia pedida. */
function minutosNaHora(inicio: Date, fim: Date, dia: Date, hora: number): number {
  const abre = new Date(dia)
  abre.setHours(hora, 0, 0, 0)
  const fecha = new Date(abre)
  fecha.setHours(hora + 1)
  const de = Math.max(inicio.getTime(), abre.getTime())
  const ate = Math.min(fim.getTime(), fecha.getTime())
  return Math.max(0, (ate - de) / 60_000)
}

type Celula = { livre: number; ocupado: number; marcadas: number }

export function GradeSemanal({
  semana,
  dias,
  classe,
  onAbrirDia,
}: {
  semana: Date[]
  dias: DiaDaAgendaDTO[]
  /** Filtro de tipo: com um escolhido, a célula conta consultas em vez de minutos. */
  classe: SlotClass | null
  onAbrirDia: (dia: Date) => void
}) {
  const { celulas, primeira, ultima, capacidadePorDia } = useMemo(() => {
    const celulas = new Map<string, Celula>()
    const capacidadePorDia = new Map<string, Record<SlotClass, number>>()
    let min = 24
    let max = 0

    for (const d of dias) {
      const data = new Date(`${d.data}T00:00:00`)
      const chaveDia = data.toDateString()

      const cap = capacidadePorDia.get(chaveDia) ?? { QUICK: 0, STANDARD: 0, EXTENDED: 0 }
      for (const k of ['QUICK', 'STANDARD', 'EXTENDED'] as SlotClass[]) cap[k] += d.capacidade[k]
      capacidadePorDia.set(chaveDia, cap)

      for (const faixa of d.atendimento) {
        min = Math.min(min, new Date(faixa.inicio).getHours())
        max = Math.max(max, new Date(faixa.fim).getHours() + 1)
      }

      for (let hora = 0; hora < 24; hora++) {
        let livre = 0
        let ocupado = 0
        let marcadas = 0
        for (const l of d.livres) {
          livre += minutosNaHora(new Date(l.inicio), new Date(l.fim), data, hora)
        }
        for (const c of d.consultas) {
          if (c.status === 'CANCELLED' || c.status === 'NO_SHOW') continue
          ocupado += minutosNaHora(new Date(c.inicio), new Date(c.ocupaAte), data, hora)
          if (new Date(c.inicio).getHours() === hora) marcadas++
        }
        if (livre + ocupado > 0) {
          const chave = `${chaveDia}|${hora}`
          const atual = celulas.get(chave) ?? { livre: 0, ocupado: 0, marcadas: 0 }
          celulas.set(chave, {
            livre: atual.livre + livre,
            ocupado: atual.ocupado + ocupado,
            marcadas: atual.marcadas + marcadas,
          })
        }
      }
    }

    return {
      celulas,
      capacidadePorDia,
      primeira: min === 24 ? 8 : min,
      ultima: max === 0 ? 18 : max,
    }
  }, [dias])

  const horas = Array.from({ length: Math.max(ultima - primeira, 1) }, (_, i) => primeira + i)

  return (
    <div className="overflow-hidden rounded-xl border" data-testid="grade-semanal">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b bg-muted/30">
        <span />
        {semana.map((d) => {
          const cap = capacidadePorDia.get(d.toDateString())
          return (
            <span key={d.toISOString()} className="py-1.5 text-center">
              <span
                className={cn(
                  'block text-[11px] font-medium',
                  mesmaData(d, new Date()) ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}{' '}
                <span className="tabular-nums">{d.getDate()}</span>
              </span>
              <span className="mt-0.5 flex justify-center gap-1.5 font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                {cap
                  ? (classe ? [classe] : (['QUICK', 'STANDARD', 'EXTENDED'] as SlotClass[])).map(
                      (k) => (
                        <span key={k} className={cn(cap[k] === 0 && 'text-muted-foreground/30')}>
                          {SIGLA_CLASSE[k]}
                          {cap[k]}
                        </span>
                      ),
                    )
                  : null}
              </span>
            </span>
          )
        })}
      </div>

      {horas.map((hora) => (
        <div
          key={hora}
          className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b last:border-0"
        >
          <span className="flex items-center justify-end pr-2 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {String(hora).padStart(2, '0')}h
          </span>

          {semana.map((dia) => {
            const c = celulas.get(`${dia.toDateString()}|${hora}`)
            const total = (c?.livre ?? 0) + (c?.ocupado ?? 0)

            return (
              <button
                key={dia.toISOString()}
                type="button"
                data-testid="celula-agenda"
                onClick={() => onAbrirDia(dia)}
                className="flex h-11 flex-col justify-center gap-1 border-l px-2 transition-colors hover:bg-accent/50"
              >
                {total === 0 ? (
                  <span className="text-[10px] text-muted-foreground/30">—</span>
                ) : (
                  <>
                    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className="bg-muted-foreground/40"
                        style={{ width: `${((c?.ocupado ?? 0) / total) * 100}%` }}
                        aria-hidden
                      />
                      <span
                        className="bg-primary/60"
                        style={{ width: `${((c?.livre ?? 0) / total) * 100}%` }}
                        aria-hidden
                      />
                    </span>
                    <span className="text-left font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {classe
                        ? `${Math.floor((c?.livre ?? 0) / OCUPACAO[classe])} cabem`
                        : `${Math.round(c?.livre ?? 0)}min`}
                      {(c?.marcadas ?? 0) > 0 && (
                        <span className="text-muted-foreground/60"> · {c!.marcadas}✓</span>
                      )}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
