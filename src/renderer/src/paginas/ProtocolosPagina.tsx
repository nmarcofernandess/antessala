/**
 * Configurações › Protocolos — onde as cirurgias são cadastradas.
 *
 * A tela responde uma pergunta só: **quando alguém marcar esta cirurgia, quais
 * perguntas a entrevista faz?** Ela não classifica risco, não sugere conduta e
 * não sabe nada sobre o paciente. Cadastrar aqui é montar um formulário, não
 * escrever protocolo clínico — e o rodapé do composer diz isso na cara.
 *
 * Regra desta fase: **incluído é obrigatório**. O que está na composição precisa
 * estar tratado para o caso ser publicado; o que ficou de fora não bloqueia.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PROCEDIMENTOS } from '@/vitrine/dados'
import { CATEGORIAS, WIDGETS, widgetPorTipo, type Categoria } from '@/vitrine/widgets/registro'
import {
  arquivarProtocolo,
  carregarProtocolos,
  duplicarProtocolo,
  restaurarFixture,
  salvarProtocolo,
  useProtocolos,
} from '@/vitrine/protocolos-store'
import { ID_PROTOCOLO_GERAL, type Protocolo } from '@shared/protocolos'

type Rascunho = {
  id?: string
  nome: string
  regime: string
  blocos: string[]
  procedimentos: string[]
}

const RASCUNHO_VAZIO: Rascunho = {
  nome: '',
  regime: '',
  blocos: [],
  procedimentos: [],
}

function doProtocolo(p: Protocolo): Rascunho {
  return {
    id: p.id,
    nome: p.nome,
    regime: p.regime,
    blocos: [...p.blocos],
    procedimentos: [...p.procedimentos],
  }
}

function mensagem(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

function semAcento(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const ORDEM_CATEGORIAS: Categoria[] = ['contexto', 'antecedentes', 'sistemas', 'medidas', 'apoio']

const TOM_CATEGORIA: Record<Categoria, string> = {
  contexto: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  antecedentes: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  sistemas: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  medidas: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  apoio: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

export function ProtocolosPagina() {
  const { protocolos, carregando, erro, persistente } = useProtocolos()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [buscaWidget, setBuscaWidget] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarReset, setConfirmarReset] = useState(false)
  const [confirmarArquivo, setConfirmarArquivo] = useState<string | null>(null)

  useEffect(() => {
    void carregarProtocolos()
  }, [])

  const emEdicao = rascunho !== null
  const original = useMemo(
    () => (rascunho?.id ? protocolos.find((p) => p.id === rascunho.id) : undefined),
    [protocolos, rascunho?.id],
  )
  const sujo = useMemo(() => {
    if (!rascunho) return false
    if (!original) return rascunho.nome.trim().length > 0 || rascunho.blocos.length > 0
    return (
      original.nome !== rascunho.nome ||
      original.regime !== rascunho.regime ||
      original.blocos.join('|') !== rascunho.blocos.join('|') ||
      original.procedimentos.join('|') !== rascunho.procedimentos.join('|')
    )
  }, [original, rascunho])

  /** Procedimento sem protocolo próprio cai no geral — a tela avisa em vez de deixar. */
  const orfaos = useMemo(() => {
    const atendidos = new Set(
      protocolos
        .filter((p) => p.id !== ID_PROTOCOLO_GERAL)
        .flatMap((p) => p.procedimentos.map((x) => semAcento(x))),
    )
    return PROCEDIMENTOS.filter((p) => !atendidos.has(semAcento(p)))
  }, [protocolos])

  /** Quem já usa cada procedimento — o seletor mostra antes de a pessoa escolher. */
  const donoDoProcedimento = useMemo(() => {
    const mapa = new Map<string, Protocolo>()
    for (const p of protocolos) {
      if (p.id === ID_PROTOCOLO_GERAL) continue
      for (const proc of p.procedimentos) mapa.set(semAcento(proc), p)
    }
    return mapa
  }, [protocolos])

  function abrir(p: Protocolo) {
    setSelecionado(p.id)
    setRascunho(doProtocolo(p))
  }

  function criar() {
    setSelecionado(null)
    setRascunho({ ...RASCUNHO_VAZIO })
    setDrawerAberto(false)
  }

  async function salvar() {
    if (!rascunho) return
    setSalvando(true)
    try {
      const salvo = await salvarProtocolo(rascunho)
      setSelecionado(salvo.id)
      setRascunho(doProtocolo(salvo))
      toast.success(
        persistente
          ? `"${salvo.nome}" salvo — versão ${salvo.versao}.`
          : `"${salvo.nome}" salvo nesta sessão. Sem banco fora do app, some ao recarregar.`,
      )
    } catch (e) {
      toast.error(mensagem(e))
    } finally {
      setSalvando(false)
    }
  }

  async function duplicar(id: string) {
    try {
      const copia = await duplicarProtocolo(id)
      abrir(copia)
      toast.success(`"${copia.nome}" criado. Escolha os procedimentos que vão usá-lo.`)
    } catch (e) {
      toast.error(mensagem(e))
    }
  }

  async function arquivar(id: string) {
    try {
      await arquivarProtocolo(id)
      if (selecionado === id) {
        setSelecionado(null)
        setRascunho(null)
      }
      toast.success('Protocolo arquivado. Os casos que ele abriu continuam explicados por ele.')
    } catch (e) {
      toast.error(mensagem(e))
    } finally {
      setConfirmarArquivo(null)
    }
  }

  async function resetar() {
    try {
      await restaurarFixture()
      setSelecionado(null)
      setRascunho(null)
      toast.success('Protocolos de volta ao estado de nascimento.')
    } catch (e) {
      toast.error(mensagem(e))
    } finally {
      setConfirmarReset(false)
    }
  }

  function alternarBloco(tipo: string) {
    setRascunho((r) => {
      if (!r) return r
      return r.blocos.includes(tipo)
        ? { ...r, blocos: r.blocos.filter((t) => t !== tipo) }
        : { ...r, blocos: [...r.blocos, tipo] }
    })
  }

  function mover(indice: number, direcao: -1 | 1) {
    setRascunho((r) => {
      if (!r) return r
      const destino = indice + direcao
      if (destino < 0 || destino >= r.blocos.length) return r
      const blocos = [...r.blocos]
      ;[blocos[indice], blocos[destino]] = [blocos[destino], blocos[indice]]
      return { ...r, blocos }
    })
  }

  function alternarProcedimento(procedimento: string) {
    setRascunho((r) => {
      if (!r) return r
      return r.procedimentos.includes(procedimento)
        ? { ...r, procedimentos: r.procedimentos.filter((p) => p !== procedimento) }
        : { ...r, procedimentos: [...r.procedimentos, procedimento] }
    })
  }

  const widgetsFiltrados = useMemo(() => {
    const termo = semAcento(buscaWidget.trim())
    return WIDGETS.filter(
      (w) => !termo || semAcento(`${w.nome} ${w.descricao}`).includes(termo),
    )
  }, [buscaWidget])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: 'Configurações', href: '/configuracoes' },
          { label: 'Protocolos de coleta' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmarReset(true)}>
              <RotateCcw className="size-4" />
              Restaurar padrão
            </Button>
            <Button size="sm" onClick={criar}>
              <Plus className="size-4" />
              Nova cirurgia
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[22rem_1fr]">
        {/* ─────────── lista ─────────── */}
        <aside className="flex min-h-0 flex-col border-r">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">
              {protocolos.length} {protocolos.length === 1 ? 'protocolo' : 'protocolos'}
            </p>
            <p className="text-xs text-muted-foreground">
              {persistente
                ? 'Salvos no banco local do app.'
                : 'Sessão sem banco: edições valem até recarregar.'}
            </p>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 p-2">
              {carregando && (
                <p className="px-2 py-4 text-sm text-muted-foreground">Carregando…</p>
              )}
              {erro && (
                <p className="px-2 py-2 text-xs text-destructive">
                  Banco indisponível ({erro}). A lista abaixo é a de fábrica.
                </p>
              )}

              {protocolos.map((p) => {
                const ativo = selecionado === p.id
                const geral = p.id === ID_PROTOCOLO_GERAL
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => abrir(p)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-left transition',
                      ativo
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-transparent hover:border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{p.nome}</span>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {p.blocos.length}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {p.regime}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">
                      {geral
                        ? 'Fallback do sistema'
                        : p.procedimentos.length > 0
                          ? p.procedimentos.join(' · ')
                          : 'Nenhum procedimento ligado ainda'}
                    </p>
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          {orfaos.length > 0 && (
            <div className="border-t bg-amber-500/5 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-3.5" />
                {orfaos.length} {orfaos.length === 1 ? 'procedimento sem' : 'procedimentos sem'}{' '}
                protocolo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {orfaos.join(' · ')} — abrem a entrevista completa.
              </p>
            </div>
          )}
        </aside>

        {/* ─────────── composer ─────────── */}
        <section className="flex min-h-0 flex-col">
          {!emEdicao ? (
            <EstadoVazioTela aoCriar={criar} />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4 border-b px-6 py-4">
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label htmlFor="protocolo-nome">Cirurgia ou procedimento</Label>
                  <Input
                    id="protocolo-nome"
                    value={rascunho.nome}
                    placeholder="Ex.: Colecistectomia"
                    disabled={rascunho.id === ID_PROTOCOLO_GERAL}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                  />
                </div>
                <div className="min-w-64 flex-1 space-y-1.5">
                  <Label htmlFor="protocolo-regime">Regime e anestesia previstos</Label>
                  <Input
                    id="protocolo-regime"
                    value={rascunho.regime}
                    placeholder="Ex.: Ambulatorial · sedação"
                    onChange={(e) => setRascunho({ ...rascunho, regime: e.target.value })}
                  />
                </div>
                {original && (
                  <Badge variant="outline" className="mb-2">
                    versão {original.versao}
                  </Badge>
                )}
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 px-6 py-5">
                  {rascunho.id !== ID_PROTOCOLO_GERAL && (
                    <SecaoProcedimentos
                      escolhidos={rascunho.procedimentos}
                      donoDoProcedimento={donoDoProcedimento}
                      idAtual={rascunho.id}
                      aoAlternar={alternarProcedimento}
                    />
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold">Composição da entrevista</h2>
                        <p className="text-xs text-muted-foreground">
                          Na ordem em que aparecem no caso. Incluído significa obrigatório para
                          publicar.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setDrawerAberto(true)}>
                        <Plus className="size-4" />
                        Adicionar widget
                      </Button>
                    </div>

                    {rascunho.blocos.length === 0 ? (
                      <EstadoVazioComposicao aoAdicionar={() => setDrawerAberto(true)} />
                    ) : (
                      <ol className="divide-y rounded-lg border">
                        {rascunho.blocos.map((tipo, i) => {
                          const w = widgetPorTipo(tipo)
                          const Icone = w?.icone
                          return (
                            <li
                              key={tipo}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                            >
                              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {i + 1}
                              </span>
                              {Icone && <Icone className="size-4 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {w?.nome ?? tipo}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {w?.descricao ?? 'Widget não existe mais no registro.'}
                                </p>
                              </div>
                              {w && (
                                <span
                                  className={cn(
                                    'hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline',
                                    TOM_CATEGORIA[w.categoria],
                                  )}
                                >
                                  {CATEGORIAS[w.categoria]}
                                </span>
                              )}
                              <div className="flex shrink-0 items-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  disabled={i === 0}
                                  aria-label="Subir"
                                  onClick={() => mover(i, -1)}
                                >
                                  <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  disabled={i === rascunho.blocos.length - 1}
                                  aria-label="Descer"
                                  onClick={() => mover(i, 1)}
                                >
                                  <ArrowDown className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover"
                                  onClick={() => alternarBloco(tipo)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>

                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Um protocolo decide <strong>quais perguntas</strong> a entrevista faz. Ele não
                    atribui risco, não define conduta e nenhuma instituição validou estas
                    composições — são decisão da demonstração.
                  </p>
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  {rascunho.blocos.length}{' '}
                  {rascunho.blocos.length === 1 ? 'widget' : 'widgets'} · {' '}
                  {rascunho.procedimentos.length}{' '}
                  {rascunho.procedimentos.length === 1 ? 'procedimento' : 'procedimentos'}
                </p>
                <div className="flex items-center gap-2">
                  {rascunho.id && rascunho.id !== ID_PROTOCOLO_GERAL && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Mais
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => duplicar(rascunho.id!)}>
                          <Copy className="size-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setConfirmarArquivo(rascunho.id!)}
                        >
                          <Trash2 className="size-4" />
                          Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRascunho(null)
                      setSelecionado(null)
                    }}
                  >
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      salvando || !sujo || !rascunho.nome.trim() || rascunho.blocos.length === 0
                    }
                    onClick={salvar}
                  >
                    <Save className="size-4" />
                    {salvando ? 'Salvando…' : 'Salvar protocolo'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ─────────── drawer de widgets ─────────── */}
      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-5 py-4">
            <SheetTitle>Widgets disponíveis</SheetTitle>
            <SheetDescription>
              Cada widget é um bloco de perguntas da entrevista. Clique para incluir ou tirar da
              composição.
            </SheetDescription>
          </SheetHeader>

          <div className="border-b px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaWidget}
                onChange={(e) => setBuscaWidget(e.target.value)}
                placeholder="Buscar widget"
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-3 py-3">
              {ORDEM_CATEGORIAS.map((categoria) => {
                const doGrupo = widgetsFiltrados.filter((w) => w.categoria === categoria)
                if (doGrupo.length === 0) return null
                return (
                  <div key={categoria} className="mb-4 last:mb-0">
                    <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {CATEGORIAS[categoria]}
                    </p>
                    <div className="flex flex-col gap-1">
                      {doGrupo.map((w) => {
                        const dentro = rascunho?.blocos.includes(w.tipo) ?? false
                        const Icone = w.icone
                        return (
                          <button
                            key={w.tipo}
                            type="button"
                            disabled={!emEdicao}
                            onClick={() => alternarBloco(w.tipo)}
                            className={cn(
                              'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50',
                              dentro
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:border-border hover:bg-muted/50',
                            )}
                          >
                            <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight">{w.nome}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {w.descricao}
                              </p>
                            </div>
                            {dentro && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {widgetsFiltrados.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhum widget com esse nome.
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="border-t px-5 py-3">
            <Button className="w-full" onClick={() => setDrawerAberto(false)}>
              Concluir
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmarReset} onOpenChange={setConfirmarReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar os protocolos de fábrica?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga os protocolos criados ou editados aqui e devolve as onze composições que
              vieram com o app. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetar}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmarArquivo !== null}
        onOpenChange={(aberto) => !aberto && setConfirmarArquivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar este protocolo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele para de abrir entrevistas novas, e os procedimentos ligados a ele passam a usar o
              protocolo geral completo. Os casos já coletados continuam explicados por ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmarArquivo && arquivar(confirmarArquivo)}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ══════════════ pedaços ══════════════ */

function SecaoProcedimentos({
  escolhidos,
  donoDoProcedimento,
  idAtual,
  aoAlternar,
}: {
  escolhidos: string[]
  donoDoProcedimento: Map<string, Protocolo>
  idAtual?: string
  aoAlternar: (procedimento: string) => void
}) {
  const [novoProcedimento, setNovoProcedimento] = useState('')

  return (
    <div>
      <h2 className="text-sm font-semibold">Procedimentos que usam este protocolo</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Um procedimento pertence a um protocolo só — senão “qual entrevista esta cirurgia abre?”
        teria duas respostas. Os esmaecidos já têm dono; passe o mouse para ver qual.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {/* O catálogo mais o que esta composição já carrega de fora dele: um
            protocolo pode atender procedimento que a recepção ainda vai cadastrar. */}
        {[...PROCEDIMENTOS, ...escolhidos.filter((p) => !PROCEDIMENTOS.includes(p))].map((proc) => {
          const dentro = escolhidos.includes(proc)
          const dono = donoDoProcedimento.get(semAcento(proc))
          const deOutro = !dentro && dono && dono.id !== idAtual
          return (
            <button
              key={proc}
              type="button"
              disabled={Boolean(deOutro)}
              title={deOutro ? `Já usado por "${dono!.nome}"` : undefined}
              onClick={() => aoAlternar(proc)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition',
                dentro
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
                deOutro &&
                  'cursor-not-allowed border-dashed bg-transparent text-muted-foreground/50 opacity-70',
              )}
            >
              {proc}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={novoProcedimento}
          onChange={(e) => setNovoProcedimento(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const valor = novoProcedimento.trim()
            if (!valor) return
            aoAlternar(valor)
            setNovoProcedimento('')
          }}
          placeholder="Procedimento fora do catálogo — digite e tecle Enter"
          className="h-8 max-w-md text-xs"
        />
      </div>
      {escolhidos.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem procedimento ligado, este protocolo existe mas não abre entrevista nenhuma sozinho —
          dá para aplicá-lo à mão dentro do caso.
        </p>
      )}
    </div>
  )
}

function EstadoVazioTela({ aoCriar }: { aoCriar: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="rounded-2xl border border-dashed p-4">
        <Layers className="size-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Escolha uma cirurgia para editar</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Ou cadastre uma nova: você dá o nome, diz o regime previsto e monta a entrevista widget
          por widget.
        </p>
      </div>
      <Button onClick={aoCriar}>
        <Plus className="size-4" />
        Nova cirurgia
      </Button>
    </div>
  )
}

function EstadoVazioComposicao({ aoAdicionar }: { aoAdicionar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
      <Layers className="size-6 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">A entrevista está vazia</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Abra o painel de widgets e escolha o que esta cirurgia precisa perguntar. Nada é
          obrigatório por padrão — obrigatório é o que você colocar aqui.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={aoAdicionar}>
        <Plus className="size-4" />
        Adicionar widget
      </Button>
      <Separator className="my-1 w-16" />
      <p className="text-[11px] text-muted-foreground">
        Dica: duplique um protocolo parecido em vez de começar do zero.
      </p>
    </div>
  )
}
