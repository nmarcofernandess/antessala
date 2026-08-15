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
import { ROTULO_CLASSE, type SlotClass, type SugestaoDTO } from '@shared/clinical/caso'
import type { BuracoDoDia } from './DiaEmpilhado'

/**
 * Marcar não é escolher no calendário: é escolher entre os próximos horários
 * que servem.
 *
 * O modal já abre com a resposta — os encaixes compatíveis com o requisito
 * daquele caso, em ordem de quem vem primeiro. Quem marca não precisa navegar a
 * agenda nem saber qual sala tem qual característica: o main já filtrou por
 * classe, por capacidade da sala e pela reserva de tempo do dia.
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
  const [sugestoes, setSugestoes] = useState<SugestaoDTO[]>([])
  const [buscando, setBuscando] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto || !caso) return
    let vivo = true
    setBuscando(true)
    api
      .sugestoes({ requirementId: caso.requirementId, limite: 24 })
      .then((v) => vivo && setSugestoes(v))
      .catch((e) => vivo && toast.error(e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setBuscando(false))
    return () => {
      vivo = false
    }
  }, [aberto, caso])

  async function marcar(s: SugestaoDTO) {
    if (!caso) return
    setMarcando(s.startsAt + s.resourceId)
    try {
      await api.reservar({
        caseId: caso.caseId,
        requirementId: caso.requirementId,
        resourceId: s.resourceId,
        startsAt: s.startsAt,
        idempotencyKey: novaChave(),
      })
      toast.success(`${caso.personName} marcada para ${quando(s.startsAt)}.`)
      onMarcado(s.startsAt)
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setMarcando(null)
    }
  }

  // Agrupado por dia: a decisão é "que dia", e só depois "que hora".
  const porDia = new Map<string, SugestaoDTO[]>()
  for (const s of sugestoes) {
    const chave = new Date(s.startsAt).toDateString()
    porDia.set(chave, [...(porDia.get(chave) ?? []), s])
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
        ) : sugestoes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nada cabe adiante. Amplie o expediente ou a reserva desta classe em
            Disponibilidade.
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
                  {doDia.map((s) => (
                    <button
                      key={s.resourceId + s.startsAt}
                      type="button"
                      disabled={marcando !== null}
                      onClick={() => marcar(s)}
                      data-testid="vaga-sugerida"
                      className="rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <span className="block font-mono text-[13px] tabular-nums">
                        {new Date(s.startsAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        {s.resourceName}
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

/**
 * Quem cabe neste buraco: o caminho inverso, a partir do horário vago.
 *
 * O filtro é o tempo: só entra quem couber no espaço que sobrou naquela sala.
 * A validação final continua sendo do main — aqui a lista só evita oferecer o
 * que vai ser recusado.
 */
export function ModalQuemCabe({
  buraco,
  fila,
  aberto,
  onFechar,
  onMarcado,
}: {
  buraco: BuracoDoDia | null
  fila: CasoDaFila[]
  aberto: boolean
  onFechar: () => void
  onMarcado: (quando: string) => void
}) {
  const [marcando, setMarcando] = useState<string | null>(null)
  const cabem = buraco
    ? fila.filter((c) => c.durationMinutes + 10 <= buraco.minutos)
    : []

  async function marcar(caso: CasoDaFila) {
    if (!buraco) return
    setMarcando(caso.caseId)
    try {
      await api.reservar({
        caseId: caso.caseId,
        requirementId: caso.requirementId,
        resourceId: buraco.resourceId,
        startsAt: buraco.inicio,
        idempotencyKey: novaChave(),
      })
      toast.success(`${caso.personName} marcada para ${quando(buraco.inicio)}.`)
      onMarcado(buraco.inicio)
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
          <DialogTitle>{buraco && quando(buraco.inicio)}</DialogTitle>
          <DialogDescription>
            {buraco && `${buraco.resourceName} · ${buraco.minutos} min livres`}
          </DialogDescription>
        </DialogHeader>

        {cabem.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Ninguém na fila cabe neste espaço.
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
