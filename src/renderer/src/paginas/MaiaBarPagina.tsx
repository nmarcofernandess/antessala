import { useEffect, useState } from 'react'
import { Clipboard, Loader2, MessageSquareText, Send, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { client } from '@/servicos/client'
import { servicoMaia } from '@/servicos/maia'
import type { MaiaCapabilitySnapshot, MaiaCommand, MaiaCommandOutput } from '@shared/index'

export function MaiaBarPagina() {
  const [prompt, setPrompt] = useState('O que eu devo responder?')
  const [output, setOutput] = useState<MaiaCommandOutput>('voice')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [capabilities, setCapabilities] = useState<MaiaCapabilitySnapshot | null>(null)

  useEffect(() => {
    let active = true
    servicoMaia
      .capabilities()
      .then((caps) => {
        if (!active) return
        setCapabilities(caps)
        if (!caps.voice.ready && output === 'voice') setOutput('text')
      })
      .catch((err) => {
        if (active) setError((err as Error).message)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextualBlocked = capabilities ? !capabilities.contextualActions.ok : false
  const contextualReason =
    capabilities && !capabilities.contextualActions.ok ? capabilities.contextualActions.reason : undefined
  const voiceReady = capabilities?.voice.ready ?? false
  const screenshotAvailable = capabilities?.supportsScreenshot ?? false

  async function run(kind: MaiaCommand['kind']) {
    // Ditar é TTS puro do clipboard (readLiteralText → say/voz), não toca a rota
    // de IA — então não bloqueia pelo gate do cérebro.
    if (kind !== 'dictate_clipboard' && contextualBlocked) {
      setError(contextualReason ?? 'A IA da Maiá não está pronta.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const command: MaiaCommand = {
        kind,
        prompt,
        inputSources: {
          selection: true,
          clipboard: true,
          // Só pede screenshot quando há visão real — nunca finge enxergar.
          screenshot: kind !== 'dictate_clipboard' && screenshotAvailable,
        },
        output,
        openChatAfter: output === 'chat',
      }
      const result = await client['maia.command.run'](command)
      setResponse(result.resposta)
    } catch (err) {
      // Regra: erro de comando vai pro usuário, nunca é engolido em silêncio.
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-svh flex-col gap-2 bg-background p-3">
      <div className="flex items-start gap-2">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Pergunte ou escolha uma acao"
          className="min-h-[48px] flex-1 resize-none"
          autoFocus
        />
        <Button size="icon" onClick={() => run('ask')} disabled={loading || contextualBlocked}>
          {loading ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => run('draft_reply')} disabled={loading || contextualBlocked}>
          <MessageSquareText />
          Responder
        </Button>
        <Button variant="outline" size="sm" onClick={() => run('summarize_clipboard')} disabled={loading || contextualBlocked}>
          <Clipboard />
          Clipboard
        </Button>
        <Button variant="outline" size="sm" onClick={() => run('dictate_clipboard')} disabled={loading}>
          <Volume2 />
          Ditar
        </Button>
        <Select value={output} onValueChange={(value) => setOutput(value as MaiaCommandOutput)}>
          <SelectTrigger className="ml-auto h-8 w-[128px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voice" disabled={!voiceReady}>
              Voz{!voiceReady && ' (sem chave)'}
            </SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="copy">Copiar</SelectItem>
            <SelectItem value="paste">Colar</SelectItem>
            <SelectItem value="replace">Substituir</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Erro concreto do comando (ex.: Ditar sem clipboard) tem prioridade e
          aparece mesmo com a rota bloqueada — senão a falha do Ditar somia
          atrás do aviso genérico de "IA não pronta". */}
      {error ? (
        <p role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : contextualBlocked ? (
        <p role="alert" className="text-xs leading-5 text-amber-600 dark:text-amber-400">
          {contextualReason ?? 'A IA da Maiá não está pronta. Configure um provedor em Configurações.'}
        </p>
      ) : null}

      {response && (
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {response}
        </p>
      )}
    </div>
  )
}
