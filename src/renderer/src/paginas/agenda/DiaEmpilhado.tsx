import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { DiaDaAgendaDTO, SlotClass } from '@shared/clinical/caso'
import { COR_CLASSE, OCUPACAO } from './GradeSemanal'

/**
 * O dia inteiro numa coluna só.
 *
 * Três consultórios no mesmo horário viram linhas seguidas, não três colunas
 * paralelas. Quem opera a recepção lê de cima para baixo e não precisa saber
 * que existe paralelismo — precisa saber o que vem agora.
 *
 * Buraco livre também é linha. É ali que a marcação começa: "das 11h20 às 12h
 * o Consultório 2 está vago" é a informação, não uma vaga fictícia de 20 min
 * que alguém criou de véspera.
 */

export type ConsultaDoDia = DiaDaAgendaDTO['consultas'][number] & {
  resourceId: string
  resourceName: string
}

export type BuracoDoDia = {
  resourceId: string
  resourceName: string
  inicio: string
  fim: string
  minutos: number
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const ATIVAS = new Set(['CONFIRMED', 'CHECKED_IN', 'COMPLETED'])

export function DiaEmpilhado({
  dias,
  classe,
  onChegada,
  onAusencia,
  onAbrirCaso,
  onUsarBuraco,
}: {
  dias: DiaDaAgendaDTO[]
  /** Com um tipo escolhido, some o buraco pequeno demais para ele. */
  classe: SlotClass | null
  onChegada: (c: ConsultaDoDia) => void
  onAusencia: (c: ConsultaDoDia) => void
  onAbrirCaso: (caseId: string) => void
  onUsarBuraco: (b: BuracoDoDia) => void
}) {
  const consultas: ConsultaDoDia[] = dias.flatMap((d) =>
    d.consultas
      .filter((c) => ATIVAS.has(c.status))
      .map((c) => ({ ...c, resourceId: d.resourceId, resourceName: d.resourceName })),
  )

  const buracos: BuracoDoDia[] = dias.flatMap((d) =>
    d.livres
      .filter(
        (l) =>
          !classe ||
          (new Date(l.fim).getTime() - new Date(l.inicio).getTime()) / 60_000 >= OCUPACAO[classe],
      )
      .map((l) => ({
      resourceId: d.resourceId,
      resourceName: d.resourceName,
      inicio: l.inicio,
      fim: l.fim,
        minutos: Math.round((new Date(l.fim).getTime() - new Date(l.inicio).getTime()) / 60_000),
      })),
  )

  const linhas = [
    ...consultas.map((c) => ({ chave: c.bookingId, quando: c.inicio, consulta: c, buraco: null })),
    ...buracos.map((b) => ({
      chave: `${b.resourceId}|${b.inicio}`,
      quando: b.inicio,
      consulta: null,
      buraco: b,
    })),
  ].sort((a, b) => a.quando.localeCompare(b.quando))

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nenhum consultório atende neste dia.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border" data-testid="dia-empilhado">
      {linhas.map(({ chave, consulta: c, buraco: b }) => (
        <div
          key={chave}
          className={cn(
            'grid grid-cols-[4.5rem_0.5rem_1fr_auto] items-center gap-3 border-b px-4 py-2.5 last:border-0',
            c && 'bg-muted/20',
          )}
          data-testid={c ? 'linha-marcada' : 'linha-livre'}
        >
          <span className="font-mono text-[12.5px] tabular-nums">
            {hora(c ? c.inicio : b!.inicio)}
          </span>
          <span
            className={cn(
              'h-6 w-1 rounded-full',
              c ? COR_CLASSE[c.slotClass] : 'bg-muted-foreground/20',
            )}
            aria-hidden
          />

          <div className="min-w-0">
            {c ? (
              <>
                <button
                  type="button"
                  onClick={() => onAbrirCaso(c.caseId)}
                  className="truncate text-[13.5px] font-medium underline-offset-2 hover:underline"
                >
                  {c.personName}
                </button>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.resourceName} · {c.displayCode}
                  {c.status === 'CHECKED_IN' && ' · chegou'}
                  {c.status === 'COMPLETED' && ' · em avaliação'}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] text-muted-foreground">
                  Livre até {hora(b!.fim)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground/70">
                  {b!.resourceName} · {b!.minutos} min
                </p>
              </>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
            {c?.status === 'CONFIRMED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => onChegada(c)}
                >
                  Chegou
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => onAusencia(c)}
                >
                  Faltou
                </Button>
              </>
            )}
            {b && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => onUsarBuraco(b)}
              >
                Usar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
