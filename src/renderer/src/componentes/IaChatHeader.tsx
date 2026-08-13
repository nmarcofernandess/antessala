import { ChevronLeft, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIaStore } from '@/store/iaStore'
import { toast } from 'sonner'

export function IaChatHeader() {
  const { tela, setTela, conversa_ativa_titulo, novaConversa, listarConversas } = useIaStore()

  async function criarConversa() {
    try {
      await novaConversa()
    } catch (error) {
      toast.error('Não foi possível criar a conversa', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function abrirHistorico() {
    try {
      await listarConversas()
      setTela('historico')
    } catch (error) {
      toast.error('Não foi possível carregar o histórico', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (tela === 'historico') {
    return (
      <div className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
        <Button variant="ghost" size="sm" onClick={() => setTela('chat')}>
          <ChevronLeft className="mr-1 size-4" /> Voltar
        </Button>
        <span className="flex-1 text-center text-sm font-semibold">Histórico</span>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => { void criarConversa() }} title="Nova conversa">
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
      <span className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold" title={conversa_ativa_titulo}>
        {conversa_ativa_titulo}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Histórico"
        onClick={() => { void abrirHistorico() }}
      >
        <History className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={() => { void criarConversa() }} title="Nova conversa">
        <Plus className="size-4" />
      </Button>
    </div>
  )
}
