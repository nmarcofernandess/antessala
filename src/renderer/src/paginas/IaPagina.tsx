import { useEffect, useRef, useState } from 'react'
import { PanelLeft, PanelLeftClose, Plus, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIaStore } from '@/store/iaStore'
import { PageHeader } from '@/componentes/PageHeader'
import { IaChatView } from '@/componentes/IaChatView'
import { IaHistoricoView } from '@/componentes/IaHistoricoView'
import { formatChatAsMarkdown } from '@/lib/chat-export'
import { toast } from 'sonner'

export function IaPagina() {
  const { inicializar, novaConversa, conversa_ativa_titulo, mensagens } = useIaStore()
  const inicializadoRef = useRef(false)
  const [sidebarAberta, setSidebarAberta] = useState(true)

  useEffect(() => {
    if (!inicializadoRef.current) {
      inicializadoRef.current = true
      void inicializar().catch((error) => {
        inicializadoRef.current = false
        toast.error('Não foi possível carregar as conversas', {
          description: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }, [inicializar])

  const hasMensagens = mensagens.length > 0

  const handleCopiarChat = async () => {
    if (!hasMensagens) return
    const md = formatChatAsMarkdown(mensagens, conversa_ativa_titulo)
    await navigator.clipboard.writeText(md)
    toast.success('Chat copiado!')
  }

  const handleNovaConversa = async () => {
    try {
      await novaConversa()
    } catch (error) {
      toast.error('Não foi possível criar a conversa', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Esquerda: toggle historico + titulo do chat
  const afterBreadcrumb = (
    <div className="flex items-center gap-1.5 min-w-0">
      <Separator orientation="vertical" className="!h-4" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setSidebarAberta((v) => !v)}
          >
            {sidebarAberta ? (
              <PanelLeftClose />
            ) : (
              <PanelLeft />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {sidebarAberta ? 'Fechar histórico' : 'Abrir histórico'}
        </TooltipContent>
      </Tooltip>
      <span
        className="text-sm text-muted-foreground truncate"
        title={conversa_ativa_titulo}
      >
        {conversa_ativa_titulo}
      </span>
    </div>
  )

  // Direita: nova conversa e cópia local do texto.
  const headerActions = (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => { void handleNovaConversa() }}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Nova conversa</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleCopiarChat} disabled={!hasMensagens}>
            <Copy />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Copiar chat</TooltipContent>
      </Tooltip>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Assistente IA' }]}
        afterBreadcrumb={afterBreadcrumb}
        actions={headerActions}
      />

      <div className="flex flex-1 min-h-0">
        {sidebarAberta && (
          <div className="w-[380px] shrink-0 flex flex-col border-r min-h-0">
            <IaHistoricoView />
          </div>
        )}

        <div className="flex flex-1 min-h-0 min-w-0 justify-center">
          <div className="flex flex-col min-h-0 w-full max-w-5xl">
            <IaChatView />
          </div>
        </div>
      </div>
    </div>
  )
}
