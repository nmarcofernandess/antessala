import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText, Loader2, MessageSquareText, Mic, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { useIaStore } from '@/store/iaStore'
import type { MaiaCapabilitySnapshot } from '@shared/index'

type MaiaOutputMode = 'voice' | 'text'

type MaiaContextualResult = {
  conversaId: string
  resposta: string
  outputMode: MaiaOutputMode
  captured: {
    selectedText: boolean
    screenshot: boolean
  }
}

export function MaiaPagina() {
  const navigate = useNavigate()
  const listarConversas = useIaStore((state) => state.listarConversas)
  const carregarConversa = useIaStore((state) => state.carregarConversa)
  const [literalText, setLiteralText] = useState('')
  const [literalLoading, setLiteralLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [manualText, setManualText] = useState('')
  const [includeScreenshot, setIncludeScreenshot] = useState(true)
  const [outputMode, setOutputMode] = useState<MaiaOutputMode>('voice')
  const [askLoading, setAskLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [lastResult, setLastResult] = useState<MaiaContextualResult | null>(null)
  const [capabilities, setCapabilities] = useState<MaiaCapabilitySnapshot | null>(null)

  useEffect(() => {
    let active = true
    servicoMaia
      .capabilities()
      .then((caps) => {
        if (!active) return
        setCapabilities(caps)
        // Sem visão real, nunca pedimos screenshot; sem chave OpenAI, não força voz.
        if (!caps.supportsScreenshot) setIncludeScreenshot(false)
        if (!caps.voice.ready) setOutputMode('text')
      })
      .catch((err) => {
        toast.error('Não consegui ler as capacidades da Maiá', { description: (err as Error).message })
      })
    return () => {
      active = false
    }
  }, [])

  const contextualBlocked = capabilities ? !capabilities.contextualActions.ok : false
  const contextualReason =
    capabilities && !capabilities.contextualActions.ok ? capabilities.contextualActions.reason : undefined
  const screenshotAvailable = capabilities?.supportsScreenshot ?? false
  const voiceReady = capabilities?.voice.ready ?? false
  const voiceReason = capabilities && !capabilities.voice.ready ? capabilities.voice.reason : undefined

  async function handleLiteralRead() {
    setLiteralLoading(true)
    try {
      const result = await client['maia.literal.read']({ text: literalText })
      toast.success('Leitura enviada para voz', {
        description: `${result.textLength} caracteres`,
      })
    } catch (err) {
      toast.error('Nao foi possivel falar', {
        description: (err as Error).message,
      })
    } finally {
      setLiteralLoading(false)
    }
  }

  async function handleContextualAsk() {
    if (!prompt.trim()) {
      toast.error('Digite a pergunta')
      return
    }
    if (contextualBlocked) {
      toast.error('IA da Maiá não está pronta', { description: contextualReason })
      return
    }

    setAskLoading(true)
    try {
      const result = await client['maia.contextual.ask']({
        prompt,
        manualText,
        includeScreenshot,
        outputMode,
      }) as MaiaContextualResult
      setLastResult(result)
      toast.success('Pergunta enviada para o FlowKit', {
        description: result.outputMode === 'voice' ? 'Resposta em voz' : 'Resposta em texto',
      })
    } catch (err) {
      toast.error('Nao foi possivel perguntar', {
        description: (err as Error).message,
      })
    } finally {
      setAskLoading(false)
    }
  }

  async function handleContextualSummary() {
    if (contextualBlocked) {
      toast.error('IA da Maiá não está pronta', { description: contextualReason })
      return
    }
    setSummaryLoading(true)
    try {
      const result = await client['maia.contextual.summarize']({
        manualText,
        includeScreenshot: false,
        outputMode,
      }) as MaiaContextualResult
      setLastResult(result)
      toast.success('Resumo criado pelo FlowKit', {
        description: result.outputMode === 'voice' ? 'Resposta em voz' : 'Resposta em texto',
      })
    } catch (err) {
      toast.error('Nao foi possivel resumir', {
        description: (err as Error).message,
      })
    } finally {
      setSummaryLoading(false)
    }
  }

  async function handleOpenChat() {
    if (!lastResult) return
    await listarConversas()
    await carregarConversa(lastResult.conversaId)
    navigate('/ia')
  }

  async function handleOpenCommandBar() {
    await client['maia.commandBar.open']()
  }

  const headerActions = (
    <Button variant="outline" size="sm" onClick={handleOpenCommandBar}>
      <MessageSquareText />
      Abrir barra Maia
    </Button>
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader breadcrumbs={[{ label: 'Maia' }]} actions={headerActions} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <section className="grid gap-4 border-b pb-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="size-4 text-muted-foreground" />
              <span>Falar</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Leitura literal, sem criar chat.
            </p>
          </div>

          <div className="space-y-3">
            <Textarea
              value={literalText}
              onChange={(event) => setLiteralText(event.target.value)}
              placeholder="Texto para ler. Se ficar vazio, a Maia tenta usar a selecao atual."
              className="min-h-[128px] resize-y"
            />
            <div className="flex justify-end">
              <Button onClick={handleLiteralRead} disabled={literalLoading}>
                {literalLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Mic />
                )}
                Falar
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquareText className="size-4 text-muted-foreground" />
              <span>Perguntar</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Nova conversa FlowKit, com memoria e RAG normais.
            </p>
          </div>

          <div className="space-y-4">
            {contextualBlocked && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{contextualReason ?? 'A IA da Maiá ainda não está pronta. Configure um provedor em Configurações.'}</span>
              </div>
            )}

            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="O que voce quer saber ou responder?"
              className="min-h-[104px] resize-y"
            />

            <Textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="Texto extra opcional"
              className="min-h-[96px] resize-y"
            />

            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeScreenshot && screenshotAvailable}
                  disabled={!screenshotAvailable}
                  onCheckedChange={(checked) => setIncludeScreenshot(checked === true)}
                />
                <span className={screenshotAvailable ? '' : 'text-muted-foreground'}>
                  Enviar screenshot
                  {!screenshotAvailable && ' (visão indisponível)'}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Label htmlFor="maia-output-mode" className="text-sm text-muted-foreground">
                  Retorno
                </Label>
                <Select value={outputMode} onValueChange={(value) => setOutputMode(value as MaiaOutputMode)}>
                  <SelectTrigger id="maia-output-mode" className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voice" disabled={!voiceReady}>
                      Voz{!voiceReady && ' (configure a chave OpenAI)'}
                    </SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!voiceReady && (
              <p className="text-xs text-muted-foreground">
                {voiceReason ?? 'Configure a chave OpenAI em Configurações → Voz da Maiá para falar as respostas.'}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleContextualSummary}
                disabled={summaryLoading || contextualBlocked}
              >
                {summaryLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}
                Resumir
              </Button>
              <Button onClick={handleContextualAsk} disabled={askLoading || contextualBlocked}>
                {askLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <MessageSquareText />
                )}
                Perguntar
              </Button>
            </div>

            {lastResult && (
              <div className="space-y-3 rounded-md border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Conversa {lastResult.conversaId}</span>
                    <span>Selecao: {lastResult.captured.selectedText ? 'sim' : 'nao'}</span>
                    <span>Screenshot: {lastResult.captured.screenshot ? 'sim' : 'nao'}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleOpenChat}>
                    <MessageSquareText />
                    Abrir no chat
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {lastResult.resposta}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
