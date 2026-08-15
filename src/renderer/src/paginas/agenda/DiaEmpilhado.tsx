import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ROTULO_CLASSE, type SlotClass, type SlotDTO } from '@shared/clinical/caso'
import { COR_CLASSE } from './GradeSemanal'

/**
 * O dia inteiro numa coluna só.
 *
 * Três consultórios no mesmo horário viram três linhas seguidas, não três
 * colunas paralelas. Quem opera a recepção lê de cima para baixo e não precisa
 * saber que existe paralelismo — precisa saber o que vem agora.
 */
export function DiaEmpilhado({
  dia,
  slots,
  classesVisiveis,
  onChegada,
  onAusencia,
  onAbrirCaso,
  onUsarVaga,
}: {
  dia: Date
  slots: SlotDTO[]
  classesVisiveis: SlotClass[]
  onChegada: (b: NonNullable<SlotDTO['booking']>) => void
  onAusencia: (b: NonNullable<SlotDTO['booking']>) => void
  onAbrirCaso: (caseId: string) => void
  onUsarVaga: (slot: SlotDTO) => void
}) {
  const doDia = slots
    .filter((s) => new Date(s.startsAt).toDateString() === dia.toDateString())
    .filter((s) => classesVisiveis.includes(s.slotClass))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  if (doDia.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nenhuma vaga neste dia.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border" data-testid="dia-empilhado">
      {doDia.map((slot) => {
        const hora = new Date(slot.startsAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
        const b = slot.booking

        return (
          <div
            key={slot.id}
            className={cn(
              'grid grid-cols-[4rem_0.5rem_1fr_auto] items-center gap-3 border-b px-4 py-2.5 last:border-0',
              b && 'bg-muted/20',
            )}
            data-testid={b ? 'linha-marcada' : 'linha-livre'}
          >
            <span className="font-mono text-[12.5px] tabular-nums">{hora}</span>
            <span className={cn('h-6 w-1 rounded-full', COR_CLASSE[slot.slotClass])} aria-hidden />

            <div className="min-w-0">
              {b ? (
                <>
                  <button
                    type="button"
                    onClick={() => onAbrirCaso(b.caseId)}
                    className="truncate text-[13.5px] font-medium underline-offset-2 hover:underline"
                  >
                    {b.personName}
                  </button>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {slot.resourceName} · {b.displayCode}
                    {b.status === 'CHECKED_IN' && ' · chegou'}
                    {b.status === 'COMPLETED' && ' · em avaliação'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13.5px] text-muted-foreground">Livre</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {slot.resourceName} · {ROTULO_CLASSE[slot.slotClass]}
                  </p>
                </>
              )}
            </div>

            <div className="flex shrink-0 gap-1">
              {b?.status === 'CONFIRMED' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onChegada(b)}>
                    Chegou
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onAusencia(b)}>
                    Faltou
                  </Button>
                </>
              )}
              {!b && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => onUsarVaga(slot)}
                >
                  Usar
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
