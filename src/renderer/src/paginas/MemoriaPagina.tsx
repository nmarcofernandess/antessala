import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  FileText,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  source_format: string
  page_count: number | null
  word_count: number
  enrichment_status: 'pending' | 'indexing' | 'ready' | 'failed'
}

type Totais = {
  total_documentos: number
  total_conceitos: number
  total_relacoes: number
}

type Evidence = Awaited<ReturnType<typeof servicoConhecimento.graphNodeEvidence>>

const ZERO_TOTALS: Totais = { total_documentos: 0, total_conceitos: 0, total_relacoes: 0 }

function cleanError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function enrichmentLabel(status: Fonte['enrichment_status']): string {
  return ({ pending: 'Aguardando enriquecimento', indexing: 'Indexando', ready: 'Enriquecido', failed: 'Enriquecimento pendente' })[status]
}

export function MemoriaPagina() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('biblioteca')
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [totais, setTotais] = useState<Totais>(ZERO_TOTALS)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enriquecendo, setEnriquecendo] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [geminiDisponivel, setGeminiDisponivel] = useState(false)
  const [geminiMensagem, setGeminiMensagem] = useState<string>()
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [sourceFilter, setSourceFilter] = useState<number | undefined>()
  const [typeFilter, setTypeFilter] = useState('')

  const carregar = useCallback(async (query = busca) => {
    setCarregando(true)
    try {
      const [stats, graph, metadata] = await Promise.all([
        servicoConhecimento.stats(query),
        servicoConhecimento.graphData(undefined, 500, sourceFilter),
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
  }, [busca, sourceFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(busca), busca ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [busca, carregar, sourceFilter])

  const visibleNodes = useMemo(
    () => typeFilter ? nodes.filter((node) => node.tipo === typeFilter) : nodes,
    [nodes, typeFilter],
  )
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleLinks = useMemo(
    () => links.filter((link) => visibleIds.has(Number(link.source)) && visibleIds.has(Number(link.target))),
    [links, visibleIds],
  )
  const entityTypes = useMemo(() => [...new Set(nodes.map((node) => node.tipo))].sort(), [nodes])

  async function alternarFonte(fonte: Fonte, ativo: boolean) {
    setFontes((atuais) => atuais.map((item) => item.id === fonte.id ? { ...item, ativo } : item))
    try {
      await servicoConhecimento.toggleAtivo(fonte.id, ativo)
    } catch (error) {
      setFontes((atuais) => atuais.map((item) => item.id === fonte.id ? { ...item, ativo: !ativo } : item))
      toast.error('Não foi possível alterar o documento', { description: cleanError(error) })
    }
  }

  async function removerFonte(fonte: Fonte) {
    try {
      await servicoConhecimento.removerFonte(fonte.id)
      toast.success('Documento removido')
      await carregar()
    } catch (error) {
      toast.error('Não foi possível remover', { description: cleanError(error) })
    }
  }

  async function enriquecer() {
    setEnriquecendo(true)
    try {
      const result = await servicoConhecimento.enrich()
      if (result.entities_count === 0 && result.relations_count === 0) {
        toast.info('Não há documentos novos aguardando enriquecimento')
      } else {
        toast.success('Grafo enriquecido', {
          description: `${result.entities_count} conceitos · ${result.relations_count} relações`,
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

  async function selectNode(node: GraphNode) {
    setSelectedNodeId(node.id)
    try {
      setEvidence(await servicoConhecimento.graphNodeEvidence(node.id))
    } catch (error) {
      toast.error('Não foi possível abrir as evidências', { description: cleanError(error) })
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/10">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Memória' }]} />

      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
        <header className="mb-7 grid gap-5 border-b pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-violet-500" /> Knowledge studio
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Memória</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Leia, edite e importe documentos de treinamento. O grafo mostra quais fontes sustentam cada conceito consultado pelo Assistente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar memória" title="Atualizar memória">
              <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => void enriquecer()} disabled={enriquecendo || totais.total_documentos === 0}>
              {enriquecendo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Enriquecer
            </Button>
            <Button size="sm" onClick={() => setDialogAberto(true)}><Upload className="size-4" /> Importar</Button>
          </div>
        </header>

        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          <Metric icon={BookOpen} label="Documentos" value={totais.total_documentos} detail="fontes editáveis" />
          <Metric icon={Sparkles} label="Conceitos" value={totais.total_conceitos} detail="entidades rastreadas" />
          <Metric icon={Network} label="Relações" value={totais.total_relacoes} detail="com evidência" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5">
            <TabsTrigger value="biblioteca" className="gap-2"><BookOpen className="size-4" /> Biblioteca</TabsTrigger>
            <TabsTrigger value="grafo" className="gap-2"><Network className="size-4" /> Grafo</TabsTrigger>
          </TabsList>

          <TabsContent value="biblioteca">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex items-center gap-3 border-b px-5 py-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por título, conteúdo, formato ou fonte" className="pl-9" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{fontes.length}</span>
                </div>

                {carregando ? <Loading label="Carregando biblioteca" /> : fontes.length === 0 ? (
                  <EmptyLibrary onImport={() => setDialogAberto(true)} hasQuery={Boolean(busca)} />
                ) : (
                  <div className="divide-y">
                    {fontes.map((fonte) => (
                      <div key={fonte.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground"><FileText className="size-4" /></div>
                        <button type="button" onClick={() => navigate(`/memoria/documentos/${fonte.id}`)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{fonte.titulo}</span>
                            {!fonte.ativo && <Badge variant="outline">Pausado</Badge>}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {fonte.source_format.toUpperCase()} · {fonte.page_count ? `${fonte.page_count} páginas` : `${fonte.word_count.toLocaleString('pt-BR')} palavras`} · atualizado {formatDate(fonte.atualizada_em)}
                          </p>
                          <p className={cn('mt-1 text-[10px]', fonte.enrichment_status === 'ready' ? 'text-emerald-600' : 'text-amber-600')}>{enrichmentLabel(fonte.enrichment_status)}</p>
                        </button>
                        <Switch checked={fonte.ativo} onCheckedChange={(ativo) => void alternarFonte(fonte, ativo)} aria-label={`Usar ${fonte.titulo} no Assistente`} />
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => void removerFonte(fonte)} aria-label={`Remover ${fonte.titulo}`}><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium">Gemini</span><span className={cn('size-2 rounded-full', geminiDisponivel ? 'bg-emerald-500' : 'bg-amber-500')} /></div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {geminiDisponivel ? 'Pronto para enriquecer novos documentos e responder com a memória.' : geminiMensagem || 'A biblioteca e a busca funcionam offline. Configure o Gemini para enriquecer novos documentos.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Como funciona</p>
                  <div className="mt-4 space-y-4">
                    <Step number="01" title="Documento" detail="Conteúdo integral e editável" />
                    <Step number="02" title="Conceitos" detail="Enriquecimento rastreável" />
                    <Step number="03" title="Evidência" detail="Origem e seção verificáveis" />
                    <Step number="04" title="Pergunta" detail="Resposta no Assistente" />
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="grafo">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
                  <div className="mr-auto"><p className="text-sm font-medium">Grafo de conhecimento</p><p className="mt-1 text-xs text-muted-foreground">Selecione um conceito para ver as fontes e seções que o sustentam.</p></div>
                  <select aria-label="Filtrar por documento" className="h-8 rounded-md border bg-background px-2 text-xs" value={sourceFilter ?? ''} onChange={(event) => setSourceFilter(event.target.value ? Number(event.target.value) : undefined)}>
                    <option value="">Todos os documentos</option>{fontes.map((fonte) => <option key={fonte.id} value={fonte.id}>{fonte.titulo}</option>)}
                  </select>
                  <select aria-label="Filtrar por tipo" className="h-8 rounded-md border bg-background px-2 text-xs" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="">Todos os tipos</option>{entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <Badge variant="secondary">{visibleNodes.length} conceitos · {visibleLinks.length} relações</Badge>
                </div>
                {visibleNodes.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-24 text-center"><Network className="size-10 text-muted-foreground/25" /><p className="mt-4 text-sm font-medium">Nenhum conceito neste filtro</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">O corpus inicial já traz evidências offline. Novos documentos podem ser enriquecidos com o Gemini.</p></div>
                ) : (
                  <ResponsiveGraph nodes={visibleNodes} links={visibleLinks} selectedNodeId={selectedNodeId} onNodeClick={(node) => void selectNode(node)} />
                )}
              </section>

              <aside className="min-h-[300px] rounded-2xl border bg-card p-5">
                {!evidence ? (
                  <div className="grid h-full min-h-[280px] place-items-center text-center"><div><Network className="mx-auto size-8 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium">Escolha um conceito</p><p className="mt-1 text-xs text-muted-foreground">As relações e os documentos de evidência aparecerão aqui.</p></div></div>
                ) : (
                  <div>
                    <Badge variant="outline">{evidence.entity.tipo}</Badge>
                    <h2 className="mt-3 text-xl font-semibold">{evidence.entity.nome}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{evidence.entity.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{evidence.relations.length} evidências em relações vizinhas</p>
                    <div className="mt-5 space-y-3">
                      {evidence.relations.map((item, index) => (
                        <article key={`${item.relation_id}-${item.source_id}-${item.section_ref}-${index}`} className="rounded-xl border p-3">
                          <p className="text-xs font-medium">{item.direction === 'saida' ? `${item.tipo_relacao} →` : `← ${item.tipo_relacao}`} {item.neighbor_name}</p>
                          <button className="mt-2 text-left text-xs font-medium text-violet-600 hover:underline" onClick={() => navigate(`/memoria/documentos/${item.source_id}`)}>{item.source_title}</button>
                          <p className="mt-1 text-[11px] text-muted-foreground">{item.section_ref} · revisão {item.source_revision}</p>
                          {item.excerpt && <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-foreground/70">{item.excerpt}</p>}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AdicionarConhecimentoDialog open={dialogAberto} onOpenChange={setDialogAberto} onSaved={() => void carregar()} iaDisponivel={geminiDisponivel} iaRouteMessage={geminiMensagem} iaRouteAction="Configure o Gemini para sugerir título e contexto. A importação local continua disponível." />
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: number; detail: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border bg-card p-4"><div className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></div><div><p className="font-mono text-2xl font-light tabular-nums">{value}</p><p className="text-xs text-muted-foreground"><span className="text-foreground">{label}</span> · {detail}</p></div></div>
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flex gap-3"><span className="font-mono text-[10px] text-muted-foreground">{number}</span><div><p className="text-xs font-medium">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p></div></div>
}

function Loading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {label}</div>
}

function EmptyLibrary({ onImport, hasQuery }: { onImport: () => void; hasQuery: boolean }) {
  return <div className="flex flex-col items-center px-6 py-20 text-center"><div className="grid size-12 place-items-center rounded-2xl border bg-muted/20"><Upload className="size-5 text-muted-foreground" /></div><p className="mt-4 text-sm font-medium">{hasQuery ? 'Nenhum documento encontrado' : 'Importe seu primeiro documento'}</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">PDF, DOCX, Markdown, texto, HTML, CSV ou JSON. O conteúdo integral fica disponível para leitura e busca.</p>{!hasQuery && <Button className="mt-5" size="sm" onClick={onImport}><Upload className="size-4" /> Importar documento</Button>}</div>
}

function ResponsiveGraph({ nodes, links, selectedNodeId, onNodeClick }: { nodes: GraphNode[]; links: GraphLink[]; selectedNodeId: number | null; onNodeClick: (node: GraphNode) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className="min-h-[600px] w-full"><GraphVisualizer nodes={nodes} links={links} width={width} height={600} selectedNodeId={selectedNodeId} onNodeClick={onNodeClick} /></div>
}
