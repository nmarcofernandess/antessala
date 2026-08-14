import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Boxes,
  FileText,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { AdicionarConhecimentoDialog } from '@/componentes/AdicionarConhecimentoDialog'
import { GraphVisualizer, type GraphLink, type GraphNode } from '@/componentes/GraphVisualizer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { servicoConhecimento } from '@/servicos/conhecimento'
import { cn } from '@/lib/utils'

type Fonte = {
  id: number
  tipo: string
  titulo: string
  importance: string
  ativo: boolean
  criada_em: string
  atualizada_em: string
  chunks_count: number
}

type Chunk = {
  id: number
  source_id: number
  conteudo: string
  importance: string
  last_accessed_at: string | null
  access_count: number
}

type Totais = {
  total_fontes: number
  total_chunks: number
  total_sistema: number
  total_usuario: number
}

const ZERO_TOTALS: Totais = {
  total_fontes: 0,
  total_chunks: 0,
  total_sistema: 0,
  total_usuario: 0,
}

function cleanError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

export function MemoriaPagina() {
  const [tab, setTab] = useState('biblioteca')
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [totais, setTotais] = useState<Totais>(ZERO_TOTALS)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enriquecendo, setEnriquecendo] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [fonteSelecionada, setFonteSelecionada] = useState<Fonte | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [carregandoChunks, setCarregandoChunks] = useState(false)
  const [geminiDisponivel, setGeminiDisponivel] = useState(false)
  const [geminiMensagem, setGeminiMensagem] = useState<string>()

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [stats, graph, metadata] = await Promise.all([
        servicoConhecimento.stats(),
        servicoConhecimento.graphData(undefined, 300),
        servicoConhecimento.metadataStatus().catch(() => null),
      ])
      setFontes(stats.fontes)
      setTotais(stats.totais)
      setNodes(graph.nodes)
      setLinks(graph.links)
      setGeminiDisponivel(Boolean(metadata?.available && metadata.provider === 'gemini'))
      setGeminiMensagem(metadata?.message)
    } catch (error) {
      toast.error('Não foi possível carregar a memória', { description: cleanError(error) })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtradas = useMemo(() => {
    const query = busca.trim().toLowerCase()
    if (!query) return fontes
    return fontes.filter((fonte) => fonte.titulo.toLowerCase().includes(query))
  }, [busca, fontes])

  async function abrirChunks(fonte: Fonte) {
    setFonteSelecionada(fonte)
    setTab('chunks')
    setCarregandoChunks(true)
    try {
      setChunks(await servicoConhecimento.listarChunks(fonte.id))
    } catch (error) {
      toast.error('Não foi possível abrir os chunks', { description: cleanError(error) })
    } finally {
      setCarregandoChunks(false)
    }
  }

  async function alternarFonte(fonte: Fonte, ativo: boolean) {
    setFontes((atuais) => atuais.map((item) => item.id === fonte.id ? { ...item, ativo } : item))
    try {
      await servicoConhecimento.toggleAtivo(fonte.id, ativo)
    } catch (error) {
      setFontes((atuais) => atuais.map((item) => item.id === fonte.id ? { ...item, ativo: !ativo } : item))
      toast.error('Não foi possível alterar a fonte', { description: cleanError(error) })
    }
  }

  async function removerFonte(fonte: Fonte) {
    try {
      await servicoConhecimento.removerFonte(fonte.id)
      toast.success('Documento removido')
      if (fonteSelecionada?.id === fonte.id) {
        setFonteSelecionada(null)
        setChunks([])
      }
      await carregar()
    } catch (error) {
      toast.error('Não foi possível remover', { description: cleanError(error) })
    }
  }

  async function enriquecer() {
    setEnriquecendo(true)
    try {
      const result = await servicoConhecimento.enrich()
      if (result.chunks_enriquecidos === 0) {
        toast.info('Nada novo para enriquecer')
      } else {
        toast.success('Grafo enriquecido', {
          description: `${result.chunks_enriquecidos} chunks · ${result.entities_count} entidades · ${result.relations_count} relações`,
        })
      }
      await carregar()
      setTab('grafo')
    } catch (error) {
      toast.error('Enriquecimento indisponível', { description: cleanError(error) })
    } finally {
      setEnriquecendo(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/10">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Memória' }]} />

      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
        <header className="mb-7 grid gap-5 border-b pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-violet-500" />
              Knowledge studio
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Memória</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Importe material de treinamento, veja como ele foi fragmentado e transforme os conceitos em um grafo que o Assistente pode consultar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar memória" title="Atualizar memória">
              <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => void enriquecer()} disabled={enriquecendo || totais.total_chunks === 0}>
              {enriquecendo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Enriquecer
            </Button>
            <Button size="sm" onClick={() => setDialogAberto(true)}>
              <Upload className="size-4" /> Importar
            </Button>
          </div>
        </header>

        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          <Metric icon={BookOpen} label="Fontes" value={totais.total_fontes} detail="documentos indexados" />
          <Metric icon={Boxes} label="Chunks" value={totais.total_chunks} detail="trechos pesquisáveis" />
          <Metric icon={Network} label="Grafo" value={nodes.length} detail={`${links.length} relações`} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5">
            <TabsTrigger value="biblioteca" className="gap-2"><BookOpen className="size-4" /> Biblioteca</TabsTrigger>
            <TabsTrigger value="chunks" className="gap-2"><Boxes className="size-4" /> Chunks</TabsTrigger>
            <TabsTrigger value="grafo" className="gap-2"><Network className="size-4" /> Grafo</TabsTrigger>
          </TabsList>

          <TabsContent value="biblioteca">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex items-center gap-3 border-b px-5 py-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar documento" className="pl-9" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{filtradas.length}</span>
                </div>

                {carregando ? (
                  <Loading label="Carregando biblioteca" />
                ) : filtradas.length === 0 ? (
                  <EmptyLibrary onImport={() => setDialogAberto(true)} />
                ) : (
                  <div className="divide-y">
                    {filtradas.map((fonte) => (
                      <div key={fonte.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground">
                          <FileText className="size-4" />
                        </div>
                        <button type="button" onClick={() => void abrirChunks(fonte)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{fonte.titulo}</span>
                            {!fonte.ativo && <Badge variant="outline">Pausado</Badge>}
                          </div>
                          <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                            {fonte.chunks_count} chunks · {fonte.tipo.replaceAll('_', ' ')}
                          </p>
                        </button>
                        <Switch checked={fonte.ativo} onCheckedChange={(ativo) => void alternarFonte(fonte, ativo)} aria-label={`Usar ${fonte.titulo} no Assistente`} />
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => void removerFonte(fonte)} aria-label={`Remover ${fonte.titulo}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Gemini</span>
                    <span className={cn('size-2 rounded-full', geminiDisponivel ? 'bg-emerald-500' : 'bg-amber-500')} />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {geminiDisponivel ? 'Pronto para enriquecer os chunks e responder usando esta memória.' : geminiMensagem || 'Configure o Gemini para gerar entidades e relações.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Pipeline</p>
                  <div className="mt-4 space-y-4">
                    <Step number="01" title="Importação" detail="Texto extraído localmente" />
                    <Step number="02" title="Chunking" detail="Trechos pesquisáveis" />
                    <Step number="03" title="Enriquecimento" detail="Entidades e relações" />
                    <Step number="04" title="Pergunta" detail="RAG no Assistente" />
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="chunks">
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{fonteSelecionada?.titulo || 'Selecione um documento'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Os trechos abaixo são as unidades recuperadas pelo Assistente.</p>
                </div>
                {fonteSelecionada && <Badge variant="secondary">{chunks.length} chunks</Badge>}
              </div>
              {carregandoChunks ? <Loading label="Abrindo chunks" /> : !fonteSelecionada ? (
                <div className="px-6 py-20 text-center text-sm text-muted-foreground">Abra um documento na Biblioteca para inspecionar seus chunks.</div>
              ) : (
                <div className="grid gap-3 p-5 md:grid-cols-2">
                  {chunks.map((chunk, index) => (
                    <article key={chunk.id} className="rounded-xl border bg-muted/15 p-4">
                      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>Chunk {String(index + 1).padStart(2, '0')}</span>
                        <span>{chunk.conteudo.length} caracteres</span>
                      </div>
                      <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{chunk.conteudo}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="grafo">
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-sm font-medium">Grafo de conhecimento</p>
                  <p className="mt-1 text-xs text-muted-foreground">Entidades extraídas dos seus documentos e as relações encontradas entre elas.</p>
                </div>
                <Badge variant="secondary">{nodes.length} nós · {links.length} relações</Badge>
              </div>
              {nodes.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-24 text-center">
                  <Network className="size-10 text-muted-foreground/25" />
                  <p className="mt-4 text-sm font-medium">O grafo nasce depois do enriquecimento</p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Importe um documento e clique em Enriquecer grafo. O Gemini encontra conceitos e relações para esta visualização.</p>
                </div>
              ) : (
                <ResponsiveGraph nodes={nodes} links={links} />
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <AdicionarConhecimentoDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSaved={() => void carregar()}
        iaDisponivel={geminiDisponivel}
        iaRouteMessage={geminiMensagem}
        iaRouteAction="Configure o Gemini para sugerir título e contexto. A importação local continua disponível."
      />
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: number; detail: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></div>
      <div><p className="font-mono text-2xl font-light tabular-nums">{value}</p><p className="text-xs text-muted-foreground"><span className="text-foreground">{label}</span> · {detail}</p></div>
    </div>
  )
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flex gap-3"><span className="font-mono text-[10px] text-muted-foreground">{number}</span><div><p className="text-xs font-medium">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p></div></div>
}

function Loading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {label}</div>
}

function EmptyLibrary({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border bg-muted/20"><Upload className="size-5 text-muted-foreground" /></div>
      <p className="mt-4 text-sm font-medium">Comece com alguns arquivos de treinamento</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Markdown, texto, PDF ou uma pasta inteira. O Antessala extrai e fragmenta tudo localmente.</p>
      <Button className="mt-5" size="sm" onClick={onImport}><Upload className="size-4" /> Importar primeiro documento</Button>
    </div>
  )
}

function ResponsiveGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className="min-h-[560px] w-full"><GraphVisualizer nodes={nodes} links={links} width={width} height={560} /></div>
}
