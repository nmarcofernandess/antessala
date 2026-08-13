import { MessageSquareDashed, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useIaStore } from '@/store/iaStore'
import { IaSecaoConversas } from './IaSecaoConversas'

export function IaHistoricoView() {
  const { conversas, busca_titulo, setBuscaTitulo, carregarConversa } = useIaStore()
  const busca = busca_titulo.toLocaleLowerCase('pt-BR')
  const filtradas = busca
    ? conversas.filter((conversa) => conversa.titulo.toLocaleLowerCase('pt-BR').includes(busca))
    : conversas
  const ativas = filtradas.filter((conversa) => conversa.status === 'ativo')
  const arquivadas = filtradas.filter((conversa) => conversa.status === 'arquivado')

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 p-2 pb-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            className="h-8 pl-8 text-xs"
            value={busca_titulo}
            onChange={(event) => setBuscaTitulo(event.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-2">
          {filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <MessageSquareDashed className="size-10 opacity-20" />
              <p className="text-xs">{busca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}</p>
            </div>
          )}
          {ativas.length > 0 && (
            <IaSecaoConversas titulo="Ativas" conversas={ativas} tipo="ativa" onAbrir={carregarConversa} />
          )}
          {ativas.length > 0 && arquivadas.length > 0 && <Separator />}
          {arquivadas.length > 0 && (
            <IaSecaoConversas
              titulo="Arquivadas"
              conversas={arquivadas}
              tipo="arquivada"
              onAbrir={carregarConversa}
              collapsible
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
