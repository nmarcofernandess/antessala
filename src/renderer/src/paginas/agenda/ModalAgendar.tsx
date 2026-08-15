import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { agenda as api, novaChave } from '@/servicos/casos'
import { ROTULO_CLASSE, type SlotClass, type SlotDTO } from '@shared/clinical/caso'

/**
 * Marcar não é escolher no calendário: é escolher entre os próximos horários
 * que servem.
 *
 * O modal já abre com a resposta — as vagas compatíveis com o requisito
 * daquele caso, em ordem de quem vem primeiro. Quem marca não precisa navegar
 * a agenda nem saber qual sala tem qual característica: o main já filtrou por
 * classe e por capacidade da sala.
 */

export type CasoDaFila = {
  caseId: string
  displayCode: string
  personName: string
  procedureDescription: string
  requirementId: string
  slotClass: SlotClass
  durationMinutes: number
  requiredCapabilities: string[]
}

export function ModalAgendar({
  caso,
  aberto,
  onFechar,
  onMarcado,
}: {
  caso: CasoDaFila | null
  aberto: boolean
  onFechar: () => void
  onMarcado: (quando: string) => void
}) {
  const [vagas, setVagas] = useState<SlotDTO[]>([])
  const [buscando, setBuscando] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto || !caso) return
    let vivo = true
    setBuscando(true)
    api
      .vagasCompativeis({ requirementId: caso.requirementId, limite: 24 })
      .then((v) => vivo && setVagas(v))
      .catch((e) => vivo && toast.error(e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setBuscando(false))
    return () => {
      vivo = false
    }
  }, [aberto, caso])

  async function marcar(slot: SlotDTO) {
    if (!caso) return
    setMarcando(slot.id)
    try {
      await api.reservar({
        caseId: caso.caseId,
        requirementId: caso.requirementId,
        slotId: slot.id,
        idempotencyKey: novaChave(),
      })
      toast.success(`${caso.personName} marcada para ${quando(slot.startsAt)}.`)
      onMarcado(slot.startsAt)
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setMarcando(null)
    }
  }

  // Agrupado por dia: a decisão é "que dia", e só depois "que hora".
  const porDia = new Map<string, SlotDTO[]>()
  for (const v of vagas) {
    const chave = new Date(v.startsAt).toDateString()
    porDia.set(chave, [...(porDia.get(chave) ?? []), v])
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg" data-testid="modal-agendar">
        <DialogHeader>
          <DialogTitle>{caso?.personName}</DialogTitle>
          <DialogDescription>
            {caso && (
              <>
                {ROTULO_CLASSE[caso.slotClass]} · {caso.durationMinutes} min
                {caso.requiredCapabilities.length > 0 && ' · sala com requisito'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {buscando ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Procurando horários…
          </p>
        ) : vagas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma vaga compatível adiante. Gere capacidade na própria agenda.
          </p>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-auto">
            {[...porDia.entries()].map(([dia, doDia]) => (
              <div key={dia}>
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                  {new Date(dia).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {doDia.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={marcando !== null}
                      onClick={() => marcar(v)}
                      data-testid="vaga-sugerida"
                      className="rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <span className="block font-mono text-[13px] tabular-nums">
                        {new Date(v.startsAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        {v.resourceName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Quem cabe nesta vaga: o caminho inverso, a partir do horário. */
export function ModalQuemCabe({
  slot,
  fila,
  aberto,
  onFechar,
  onMarcado,
}: {
  slot: SlotDTO | null
  fila: CasoDaFila[]
  aberto: boolean
  onFechar: () => void
  onMarcado: (quando: string) => void
}) {
  const [marcando, setMarcando] = useState<string | null>(null)
  const cabem = slot ? fila.filter((c) => c.slotClass === slot.slotClass) : []

  async function marcar(caso: CasoDaFila) {
    if (!slot) return
    setMarcando(caso.caseId)
    try {
      await api.reservar({
        caseId: caso.caseId,
        requirementId: caso.requirementId,
        slotId: slot.id,
        idempotencyKey: novaChave(),
      })
      toast.success(`${caso.personName} marcada para ${quando(slot.startsAt)}.`)
      onMarcado(slot.startsAt)
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setMarcando(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg" data-testid="modal-quem-cabe">
        <DialogHeader>
          <DialogTitle>{slot && quando(slot.startsAt)}</DialogTitle>
          <DialogDescription>
            {slot && `${slot.resourceName} · ${ROTULO_CLASSE[slot.slotClass]}`}
          </DialogDescription>
        </DialogHeader>

        {cabem.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Ninguém na fila precisa deste tamanho de vaga.
          </p>
        ) : (
          <div className="max-h-[26rem] space-y-1.5 overflow-auto">
            {cabem.map((c) => (
              <button
                key={c.caseId}
                type="button"
                disabled={marcando !== null}
                onClick={() => marcar(c)}
                data-testid="caso-compativel"
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{c.personName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {c.procedureDescription}
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {c.durationMinutes} min
                </Badge>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
