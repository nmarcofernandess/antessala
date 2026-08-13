import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Loader2, Save, Settings, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { client } from '@/servicos/client'
import {
  CLOUD_PROVIDER_DEFAULTS,
  CLOUD_PROVIDER_LABELS,
  normalizeCloudIaConfig,
  type CloudIaProvider,
} from '@/hooks/useIaModelConfig'

interface ProviderDraft {
  apiKey: string
  modelo: string
  configurado: boolean
}

const EMPTY_DRAFTS: Record<CloudIaProvider, ProviderDraft> = {
  gemini: { apiKey: '', modelo: CLOUD_PROVIDER_DEFAULTS.gemini, configurado: false },
  openrouter: { apiKey: '', modelo: CLOUD_PROVIDER_DEFAULTS.openrouter, configurado: false },
}

function providerConfigsJson(provider: CloudIaProvider, modelo: string): string {
  return JSON.stringify({ [provider]: { modelo } })
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

export function ConfiguracoesPagina() {
  const [provider, setProvider] = useState<CloudIaProvider>('gemini')
  const [drafts, setDrafts] = useState<Record<CloudIaProvider, ProviderDraft>>(EMPTY_DRAFTS)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [mostrarToken, setMostrarToken] = useState(false)

  const draft = drafts[provider]

  useEffect(() => {
    let active = true
    client['ia.configuracao.obter']()
      .then((raw) => {
        if (!active) return
        const config = normalizeCloudIaConfig(raw)
        if (!config) return
        setProvider(config.provider)
        setDrafts((current) => ({
          ...current,
          [config.provider]: {
            apiKey: '',
            modelo: config.modelo,
            configurado: config.configurado,
          },
        }))
      })
      .catch((error) => {
        toast.error('Não foi possível carregar a configuração', { description: errorMessage(error) })
      })
      .finally(() => {
        if (active) setCarregando(false)
      })
    return () => { active = false }
  }, [])

  function updateDraft(patch: Partial<ProviderDraft>) {
    setDrafts((current) => ({
      ...current,
      [provider]: { ...current[provider], ...patch },
    }))
  }

  async function salvar() {
    if (!draft.modelo.trim()) {
      toast.error('Informe o modelo')
      return
    }
    setSalvando(true)
    try {
      const saved = await client['ia.configuracao.salvar']({
        provider,
        api_key: draft.apiKey.trim(),
        modelo: draft.modelo.trim(),
        provider_configs_json: providerConfigsJson(provider, draft.modelo.trim()),
      })
      const normalized = normalizeCloudIaConfig(saved)
      updateDraft({ apiKey: '', configurado: normalized?.configurado ?? true })
      window.dispatchEvent(new Event('ia-config-changed'))
      toast.success('Configuração salva')
    } catch (error) {
      toast.error('Não foi possível salvar', { description: errorMessage(error) })
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    if (!draft.modelo.trim()) {
      toast.error('Informe o modelo')
      return
    }
    setTestando(true)
    try {
      const result = await client['ia.configuracao.testar']({
        provider,
        api_key: draft.apiKey.trim(),
        modelo: draft.modelo.trim(),
        provider_configs_json: providerConfigsJson(provider, draft.modelo.trim()),
      })
      toast.success(result.mensagem || 'Conexão validada')
    } catch (error) {
      toast.error('Teste de conexão falhou', { description: errorMessage(error) })
    } finally {
      setTestando(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader breadcrumbs={[{ label: 'Configurações' }]} />
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Settings className="size-5" /></div>
              <div>
                <CardTitle>Assistente IA</CardTitle>
                <CardDescription>
                  Escolha um provedor cloud. Só um fica ativo por vez.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando configuração...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ia-provider">Provedor</Label>
                  <Select value={provider} onValueChange={(value) => setProvider(value as CloudIaProvider)}>
                    <SelectTrigger id="ia-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">{CLOUD_PROVIDER_LABELS.gemini}</SelectItem>
                      <SelectItem value="openrouter">{CLOUD_PROVIDER_LABELS.openrouter}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ia-token">Token da API</Label>
                  <div className="relative">
                    <Input
                      id="ia-token"
                      type={mostrarToken ? 'text' : 'password'}
                      value={draft.apiKey}
                      onChange={(event) => updateDraft({ apiKey: event.target.value })}
                      placeholder={draft.configurado ? 'Chave salva — deixe vazio para manter' : 'Cole a chave do provedor'}
                      autoComplete="off"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                      onClick={() => setMostrarToken((current) => !current)}
                      aria-label={mostrarToken ? 'Ocultar token' : 'Mostrar token'}
                    >
                      {mostrarToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  {draft.configurado && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> Token salvo localmente.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ia-modelo">Modelo</Label>
                  <Input
                    id="ia-modelo"
                    value={draft.modelo}
                    onChange={(event) => updateDraft({ modelo: event.target.value })}
                    placeholder={CLOUD_PROVIDER_DEFAULTS[provider]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o identificador exato aceito pelo provedor.
                  </p>
                </div>

                <Alert>
                  <AlertDescription className="text-xs leading-relaxed">
                    O banco e os catálogos clínicos continuam locais. Apenas as mensagens enviadas ao assistente
                    saem do computador quando você usa a IA cloud.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={testar} disabled={testando || salvando}>
                    {testando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wifi className="mr-2 size-4" />}
                    Testar conexão
                  </Button>
                  <Button onClick={salvar} disabled={salvando || testando}>
                    {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    Salvar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
