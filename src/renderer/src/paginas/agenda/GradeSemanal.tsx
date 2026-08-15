import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SlotClass, SlotDTO } from '@shared/clinical/caso'

/**
 * A semana como densidade, não como calendário.
 *
 * Uma clínica com três consultórios não tem três agendas paralelas — tem uma
 * quantidade de vagas por faixa de hora. Empilhar as salas lado a lado só
 * mostra que existem três colunas; o que a recepção precisa saber é *quantos
 * horários de cada tamanho sobraram*, e isso cabe numa célula.
 *
 * Quando cada sala atende é regra semanal, editada uma vez em Disponibilidade —
 * não algo que se libere semana a semana nesta grade.
 */

/** Faixa mínima mostrada; a grade cresce se o expediente for maior. */
export const HORA_INICIAL = 7
export const HORA_FINAL = 19

export const COR_CLASSE: Record<SlotClass, string> = {
  QUICK: 'bg-emerald-500',
  STANDARD: 'bg-blue-500',
  EXTENDED: 'bg-amber-500',
}

export type CelulaDensidade = {
  dia: Date
  hora: number
  livres: number
  ocupadas: number
  porClasse: Record<SlotClass, number>
}

function mesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
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

export function GradeSemanal({
  semana,
  slots,
  classesVisiveis,
  onAbrirDia,
}: {
  semana: Date[]
  slots: SlotDTO[]
  classesVisiveis: SlotClass[]
  onAbrirDia: (dia: Date) => void
}) {

  const celulas = useMemo(() => {
    const mapa = new Map<string, CelulaDensidade>()
    for (const slot of slots) {
      if (!classesVisiveis.includes(slot.slotClass)) continue
      const inicio = new Date(slot.startsAt)
      const hora = inicio.getHours()
      const chave = `${inicio.toDateString()}|${hora}`
      const atual = mapa.get(chave) ?? {
        dia: inicio,
        hora,
        livres: 0,
        ocupadas: 0,
        porClasse: { QUICK: 0, STANDARD: 0, EXTENDED: 0 },
      }
      if (slot.booking) atual.ocupadas++
      else {
        atual.livres++
        atual.porClasse[slot.slotClass]++
      }
      mapa.set(chave, atual)
    }
    return mapa
  }, [slots, classesVisiveis])

  // A grade acompanha o expediente: se alguém atende às 20h, a linha das 20h
  // existe. Sem isso a agenda esconderia vaga que a disponibilidade abriu.
  const { primeira, ultima } = useMemo(() => {
    let min = HORA_INICIAL
    let max = HORA_FINAL
    for (const s of slots) {
      const h = new Date(s.startsAt).getHours()
      if (h < min) min = h
      if (h + 1 > max) max = h + 1
    }
    return { primeira: min, ultima: max }
  }, [slots])

  const horas = Array.from({ length: ultima - primeira }, (_, i) => primeira + i)

  return (
    <div className="overflow-hidden rounded-xl border" data-testid="grade-semanal">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b bg-muted/30">
        <span />
        {semana.map((d) => (
          <span
            key={d.toISOString()}
            className={cn(
              'py-2 text-center text-[11px] font-medium',
              mesmaData(d, new Date()) && 'text-foreground',
              !mesmaData(d, new Date()) && 'text-muted-foreground',
            )}
          >
            {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}{' '}
            <span className="tabular-nums">{d.getDate()}</span>
          </span>
        ))}
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
            const celula = celulas.get(`${dia.toDateString()}|${hora}`)
            const total = (celula?.livres ?? 0) + (celula?.ocupadas ?? 0)

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
                    <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                      {(['QUICK', 'STANDARD', 'EXTENDED'] as SlotClass[]).map((c) => {
                        const n = celula?.porClasse[c] ?? 0
                        if (n === 0) return null
                        return (
                          <span
                            key={c}
                            className={cn('shrink-0', COR_CLASSE[c])}
                            style={{ width: `${(n / Math.max(total, 1)) * 100}%` }}
                            aria-hidden
                          />
                        )
                      })}
                      {(celula?.ocupadas ?? 0) > 0 && (
                        <span
                          className="shrink-0 bg-muted-foreground/30"
                          style={{ width: `${((celula?.ocupadas ?? 0) / total) * 100}%` }}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="text-left font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {celula?.livres ?? 0}
                      {(celula?.ocupadas ?? 0) > 0 && (
                        <span className="text-muted-foreground/60"> · {celula?.ocupadas}✓</span>
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
