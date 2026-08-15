import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { capacidade as api } from '@/servicos/casos'

/**
 * As salas onde a consulta acontece.
 *
 * O que a sala tem não é enfeite: é o que decide quem cabe nela. O requisito do
 * caso consulta essas marcas antes de oferecer a vaga.
 */

type Recurso = {
  id: string
  nome: string
  capabilities: string[]
  ativo: boolean
  diasAtivos: number
  consultasFuturas: number
}

const MARCAS = [
  { id: 'SALA_ACESSIVEL', rotulo: 'Acessível' },
  { id: 'ESPACO_ACOMPANHANTE', rotulo: 'Acompanhante' },
  { id: 'APOIO_COMUNICACAO', rotulo: 'Comunicação' },
]

export function DialogConsultorios({ onMudou }: { onMudou?: () => void }) {
  const [lista, setLista] = useState<Recurso[]>([])
  const [editando, setEditando] = useState<Recurso | null>(null)
  const [nome, setNome] = useState('')
  const [marcas, setMarcas] = useState<string[]>([])

  const recarregar = useCallback(async () => {
    try {
      setLista((await api.consultorios()) as Recurso[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  function editar(r: Recurso | null) {
    setEditando(
      r ?? { id: '', nome: '', capabilities: [], ativo: true, diasAtivos: 0, consultasFuturas: 0 },
    )
    setNome(r?.nome ?? '')
    setMarcas(r?.capabilities ?? [])
  }

  async function salvar() {
    if (!editando) return
    try {
      await api.salvarConsultorio({
        id: editando.id || undefined,
        nome,
        capabilities: marcas,
        ativo: editando.ativo,
      })
      setEditando(null)
      await recarregar()
      onMudou?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-2" data-testid="consultorios">
      {lista.map((r) => (
        <div
          key={r.id}
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
            !r.ativo && 'opacity-50',
          )}
          data-testid="consultorio-item"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium">{r.nome}</p>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {r.capabilities.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">
                  {MARCAS.find((m) => m.id === c)?.rotulo ?? c}
                </Badge>
              ))}
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {r.diasAtivos} dias/semana
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              checked={r.ativo}
              aria-label={`${r.nome} ativo`}
              onCheckedChange={async (v) => {
                await api.salvarConsultorio({
                  id: r.id,
                  nome: r.nome,
                  capabilities: r.capabilities,
                  ativo: v,
                })
                await recarregar()
                onMudou?.()
              }}
            />
            <Button size="icon" variant="ghost" className="size-8" onClick={() => editar(r)}>
              <Pencil className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {editando ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <Input
            autoFocus
            aria-label="Nome do consultório"
            value={nome}
            placeholder="Consultório 4"
            onChange={(e) => setNome(e.target.value)}
            className="h-8"
          />
          <div className="flex flex-wrap gap-1.5">
            {MARCAS.map((m) => {
              const on = marcas.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setMarcas((a) => (on ? a.filter((x) => x !== m.id) : [...a, m.id]))
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    on ? 'bg-accent' : 'text-muted-foreground/60',
                  )}
                >
                  {m.rotulo}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={nome.trim().length < 2} onClick={salvar} data-testid="salvar-consultorio">
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => editar(null)}
          data-testid="novo-consultorio"
        >
          <Plus className="size-3.5" /> Novo consultório
        </Button>
      )}
    </div>
  )
}
