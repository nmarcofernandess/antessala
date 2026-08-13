import { useEffect, useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { servicoMaia } from '@/servicos/maia'
import { DEFAULT_MAIA_VOICE_CONFIG, MAIA_TTS_PROVIDERS, type MaiaVoiceConfig } from '@shared/index'

export function VozDaMaiaCard() {
  const [config, setConfig] = useState<MaiaVoiceConfig>(DEFAULT_MAIA_VOICE_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let active = true
    servicoMaia
      .voiceObter()
      .then((cfg) => {
        if (active) setConfig(cfg)
      })
      .catch((err) => {
        toast.error('Não consegui carregar a voz da Maiá', { description: (err as Error).message })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const provider = MAIA_TTS_PROVIDERS.find((p) => p.id === config.provider) ?? MAIA_TTS_PROVIDERS[0]

  async function persist(patch: Partial<MaiaVoiceConfig>) {
    setSaving(true)
    try {
      const next = await servicoMaia.voiceSalvar(patch)
      setConfig(next)
    } catch (err) {
      toast.error('Não consegui salvar a voz', { description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestar() {
    setTesting(true)
    try {
      const result = await servicoMaia.voiceTestar({ text: 'Olá, aqui é a Maiá testando a voz.' })
      if (result.ok) {
        toast.success(
          result.provider === 'openai' ? 'Voz OpenAI tocada!' : 'Sem chave OpenAI — toquei pela voz do sistema (say).',
        )
      } else {
        toast.error('Falha ao testar a voz', { description: result.error })
      }
    } catch (err) {
      toast.error('Falha ao testar a voz', { description: (err as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="size-4" />
          Voz da Maiá
        </CardTitle>
        <CardDescription>
          Voz da OpenAI para a Maiá falar as respostas. Sem chave, a Maiá usa a voz do sistema (say).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="maia-voice-provider">Provedor</Label>
          <Select value={config.provider} onValueChange={(value) => void persist({ provider: value as MaiaVoiceConfig['provider'] })}>
            <SelectTrigger id="maia-voice-provider" disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAIA_TTS_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maia-voice-key">Chave OpenAI</Label>
          <Input
            id="maia-voice-key"
            type="password"
            placeholder="sk-..."
            value={config.api_key}
            disabled={loading}
            onChange={(event) => setConfig((prev) => ({ ...prev, api_key: event.target.value }))}
            onBlur={(event) => void persist({ api_key: event.target.value.trim() })}
          />
          <p className="text-xs text-muted-foreground">
            A mesma chave da OpenAI; usada só para a voz. Fica salva localmente, nunca sai do app.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maia-voice-voice">Voz</Label>
          <Select value={config.voice} onValueChange={(value) => void persist({ voice: value })}>
            <SelectTrigger id="maia-voice-voice" disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider.voices.map((voice) => (
                <SelectItem key={voice} value={voice}>
                  {voice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{saving ? 'Salvando…' : 'Alterações salvas automaticamente'}</span>
          <Button variant="outline" size="sm" onClick={handleTestar} disabled={testing || loading}>
            {testing ? <Loader2 className="animate-spin" /> : <Volume2 />}
            Testar voz
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
