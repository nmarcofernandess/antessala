import { useEffect, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client } from '@/servicos/client'
import { cn } from '@/lib/utils'

const DEFAULT_MODEL = 'gemini-3.5-flash'

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

export function ConfiguracoesPagina() {
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState(DEFAULT_MODEL)
  const [configurado, setConfigurado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [mostrarToken, setMostrarToken] = useState(false)

  useEffect(() => {
    let active = true
    client['ia.configuracao.obter']()
      .then((config) => {
        if (!active || !config) return
        setModelo(config.modelo || DEFAULT_MODEL)
        setConfigurado(Boolean(config.configurado))
      })
      .catch((error) => {
        toast.error('Não foi possível carregar a configuração', {
          description: errorMessage(error),
        })
      })
      .finally(() => active && setCarregando(false))
    return () => { active = false }
  }, [])

  const payload = () => ({
    provider: 'gemini' as const,
    api_key: apiKey.trim(),
    modelo: modelo.trim() || DEFAULT_MODEL,
    provider_configs_json: JSON.stringify({
      gemini: { modelo: modelo.trim() || DEFAULT_MODEL },
    }),
  })

  async function salvar() {
    setSalvando(true)
    try {
      const saved = await client['ia.configuracao.salvar'](payload())
      setConfigurado(Boolean(saved?.configurado))
      setApiKey('')
      window.dispatchEvent(new Event('ia-config-changed'))
      toast.success('Gemini configurado')
    } catch (error) {
      toast.error('Não foi possível salvar', { description: errorMessage(error) })
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    setTestando(true)
    try {
      const result = await client['ia.configuracao.testar'](payload())
      toast.success(result.mensagem || 'Gemini conectado')
    } catch (error) {
      toast.error('Teste de conexão falhou', { description: errorMessage(error) })
    } finally {
      setTestando(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/10">
      <PageHeader breadcrumbs={[{ label: 'Configurações' }]} />

      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Studio · conexão
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Uma única conexão para conversar com a memória e enriquecer o grafo de conhecimento.
            </p>
          </div>
          <div className={cn(
            'flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
            configurado
              ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
              : 'bg-background text-muted-foreground',
          )}>
            <span className={cn('size-1.5 rounded-full', configurado ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
            {configurado ? 'Gemini pronto' : 'Aguardando conexão'}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-4 border-b px-6 py-5">
              <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500/15 via-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-300">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Google Gemini</h2>
                <p className="text-xs text-muted-foreground">Chat e enriquecimento do conhecimento</p>
              </div>
              {configurado && <Check className="size-4 text-emerald-600" />}
            </div>

            <div className="space-y-6 p-6">
              {carregando ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Carregando conexão...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ia-token">Token da API</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="ia-token"
                        type={mostrarToken ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={configurado ? 'Chave salva — deixe vazio para manter' : 'Cole sua chave Gemini'}
                        autoComplete="off"
                        className="pl-9 pr-10"
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
                    <p className="text-xs text-muted-foreground">
                      {configurado ? 'A chave já salva não é exibida novamente.' : 'Usada somente quando você envia uma mensagem ou inicia o enriquecimento.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ia-modelo">Modelo</Label>
                    <Input
                      id="ia-modelo"
                      value={modelo}
                      onChange={(event) => setModelo(event.target.value)}
                      placeholder={DEFAULT_MODEL}
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
                    <Button variant="outline" onClick={testar} disabled={testando || salvando}>
                      {testando ? <Loader2 className="size-4 animate-spin" /> : <Wifi className="size-4" />}
                      Testar conexão
                    </Button>
                    <Button onClick={salvar} disabled={salvando || testando}>
                      {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Salvar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <ShieldCheck className="size-5 text-emerald-600" />
              <h3 className="mt-4 text-sm font-semibold">Local primeiro</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Arquivos, chunks e grafo permanecem no computador. Só a pergunta e os trechos recuperados saem quando você usa o Gemini.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Fluxo</p>
              <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li><span className="mr-2 text-foreground">01</span>Importe documentos em Memória</li>
                <li><span className="mr-2 text-foreground">02</span>Enriqueça para gerar o grafo</li>
                <li><span className="mr-2 text-foreground">03</span>Pergunte no Assistente</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
