import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Loader2 } from 'lucide-react'
import { PageHeader } from '@/componentes/PageHeader'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Rotulo } from '@/vitrine/pecas'
import { casos } from '@/servicos/casos'
import { ROTULO_STATUS, type CaseSummaryDTO } from '@shared/clinical/caso'

/**
 * Casos que terminaram.
 *
 * Um caso só chega aqui por um de dois caminhos: o serviço solicitante
 * confirmou o recebimento do resultado, ou o caso foi cancelado. Nenhum
 * vencimento de prazo arquiva sozinho — a lista é curta porque encerrar é um
 * ato, não uma consequência do calendário.
 *
 * O que continua aberto: a cirurgia. Este arquivo é da consulta
 * pré-anestésica, e o que acontece depois dela pertence a outro sistema.
 */
export function ArquivadosPagina() {
  const [lista, setLista] = useState<CaseSummaryDTO[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    casos
      .listar({ status: ['DELIVERED_TO_REQUESTER', 'CANCELLED'] })
      .then((itens) => vivo && setLista(itens))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Arquivados' }]} />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-4xl p-6 lg:p-8" data-testid="arquivados">
          <Rotulo>Casos encerrados</Rotulo>
          <p className="mb-5 mt-1 text-xs text-muted-foreground">
            Entregues ao serviço solicitante ou cancelados. A história de cada um continua
            inteira — arquivar não apaga nada.
          </p>

          {carregando ? (
            <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </p>
          ) : erro ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{erro}</p>
          ) : lista.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Archive className="size-5" />
              Nenhum caso encerrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {lista.map((c) => (
                <Link
                  key={c.id}
                  to={`/casos/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {c.displayCode}
                      </span>
                      <Badge variant="outline">{ROTULO_STATUS[c.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm font-medium">{c.personName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.procedureDescription} · {c.serviceName}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
