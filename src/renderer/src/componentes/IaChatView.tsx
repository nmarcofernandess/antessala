import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Bot, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { IaChatInput } from './IaChatInput'
import { IaMensagemBubble } from './IaMensagemBubble'
import { useIaModelConfig } from '@/hooks/useIaModelConfig'
import { useIaStore } from '@/store/iaStore'
import { client } from '@/servicos/client'
import type { IaMensagem } from '@shared/index'

function cleanErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

export function IaChatView() {
  const {
    mensagens,
    carregando,
    setCarregando,
    conversa_ativa_id,
    adicionarMensagem,
    editarEReenviar,
  } = useIaStore()
  const modelConfig = useIaModelConfig()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }, [mensagens, carregando])

  const inputDisabled = carregando
    || !conversa_ativa_id
    || modelConfig.isLoading
    || !modelConfig.canSendMessages

  async function enviar(conteudoOverride?: string) {
    const conteudo = (conteudoOverride ?? texto).trim()
    if (!conteudo || inputDisabled || !conversa_ativa_id) return

    const historico = conteudoOverride
      ? useIaStore.getState().mensagens.slice(0, -1)
      : useIaStore.getState().mensagens

    if (!conteudoOverride) {
      await adicionarMensagem({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        papel: 'usuario',
        conteudo,
      })
      setTexto('')
    }

    setCarregando(true)
    try {
      const resultado = await client['ia.chat.enviar']({
        mensagem: conteudo,
        historico,
        conversa_id: conversa_ativa_id,
      })
      await adicionarMensagem({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        papel: 'assistente',
        conteudo: resultado.resposta,
      })
    } catch (error) {
      toast.error('Não foi possível responder', { description: cleanErrorMessage(error) })
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarEdicao() {
    if (!editingMsgId || !editText.trim() || carregando) return
    const conteudo = await editarEReenviar(editingMsgId, editText.trim())
    setEditingMsgId(null)
    setEditText('')
    if (conteudo) await enviar(conteudo)
  }

  async function regenerar(mensagem: IaMensagem) {
    if (carregando) return
    const index = mensagens.findIndex((item) => item.id === mensagem.id)
    const usuario = mensagem.papel === 'usuario'
      ? mensagem
      : [...mensagens.slice(0, index)].reverse().find((item) => item.papel === 'usuario')
    if (!usuario) return

    const conteudo = await editarEReenviar(usuario.id, usuario.conteudo)
    if (conteudo) await enviar(conteudo)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
        <div className="flex min-w-0 max-w-full flex-col gap-4 p-4">
          {mensagens.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-muted-foreground">
              <Bot className="size-12 opacity-20" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {modelConfig.canSendMessages ? 'Como posso ajudar?' : 'IA não configurada'}
                </p>
                <p className="max-w-sm text-xs leading-relaxed">
                  {modelConfig.canSendMessages
                    ? 'Pergunte sobre os documentos da Memória. O Assistente recupera os trechos mais relevantes antes de responder.'
                    : modelConfig.activeProviderReason}
                </p>
              </div>
              {!modelConfig.canSendMessages && !modelConfig.isLoading && (
                <Button size="sm" variant="outline" onClick={() => navigate('/configuracoes')}>
                  <Settings className="mr-1.5 size-3.5" />
                  Abrir configurações
                </Button>
              )}
            </div>
          )}

          {mensagens
            .filter((mensagem) => mensagem.papel === 'usuario' || mensagem.papel === 'assistente')
            .map((mensagem) => (
              <div key={mensagem.id} className="min-w-0 max-w-full">
                {editingMsgId === mensagem.id ? (
                  <div className="ml-auto flex w-full max-w-[88%] flex-col gap-2">
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      className="min-h-24 resize-none rounded-md border bg-background p-3 text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingMsgId(null)}>Cancelar</Button>
                      <Button size="sm" onClick={confirmarEdicao}>Reenviar</Button>
                    </div>
                  </div>
                ) : (
                  <IaMensagemBubble
                    msg={mensagem}
                    onEdit={mensagem.papel === 'usuario' ? (item) => {
                      setEditingMsgId(item.id)
                      setEditText(item.conteudo)
                    } : undefined}
                    onRegenerate={regenerar}
                    showActions={!carregando && modelConfig.canSendMessages}
                  />
                )}
              </div>
            ))}

          {carregando && (
            <div className="flex max-w-[70%] items-center gap-2 rounded-2xl rounded-bl-sm border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
              Pensando...
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {!modelConfig.isLoading && !modelConfig.canSendMessages && mensagens.length > 0 && (
        <div className="px-3 pt-3">
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription className="flex items-center justify-between gap-3 text-xs">
              <span>{modelConfig.activeProviderReason}</span>
              <Button size="sm" variant="outline" onClick={() => navigate('/configuracoes')}>Configurar</Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <IaChatInput
        value={texto}
        onChange={setTexto}
        onEnviar={() => { void enviar() }}
        disabled={inputDisabled}
        providerLabel={modelConfig.providerLabel}
        modelo={modelConfig.config?.modelo}
      />
    </div>
  )
}
