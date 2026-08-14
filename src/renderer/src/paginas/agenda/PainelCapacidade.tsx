import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { cn } from '@/lib/utils'
import { Rotulo } from '@/vitrine/pecas'
import { capacidade as api } from '@/servicos/casos'
import { ROTULO_CLASSE, type SlotClass } from '@shared/clinical/caso'

/**
 * A oferta da agenda, editável.
 *
 * Enquanto consultório e horário eram constante compilada, a demonstração
 * dizia à operação como ela trabalha. Aqui é o contrário: a operação declara
 * quantas salas tem, quando elas abrem e que mistura de vagas oferece.
 *
 * A duração de cada vaga **não** é editável, e isso é deliberado: ela vem da
 * mesma regra que dimensiona o requisito do caso. Uma vaga rápida de trinta
 * minutos faria o requisito prometer um encaixe que a sala não cumpre.
 */

type Recurso = {
  id: string
  nome: string
  capabilities: string[]
  ativo: boolean
  vagasFuturas: number
  vagasOcupadas: number
}

const CAPABILITIES = [
  { id: 'SALA_ACESSIVEL', rotulo: 'Sala acessível' },
  { id: 'ESPACO_ACOMPANHANTE', rotulo: 'Espaço p/ acompanhante' },
  { id: 'APOIO_COMUNICACAO', rotulo: 'Apoio à comunicação' },
]

const DIAS = [
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
  { valor: 0, rotulo: 'Dom' },
]

const CLASSES: SlotClass[] = ['QUICK', 'STANDARD', 'EXTENDED']

/** `08:00` ⇄ 480. A tela fala em horas; o serviço, em minutos do dia. */
function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}
function paraHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}
function hojeISO(soma = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + soma)
  return d.toISOString().slice(0, 10)
}

export function PainelCapacidade({ onMudou }: { onMudou?: () => void }) {
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [resumo, setResumo] = useState<{
    porClasse: Array<{ slotClass: SlotClass; livres: number; ocupadas: number }>
    ate: string | null
  } | null>(null)
  const [carregando, setCarregando] = useState(true)

  const [editando, setEditando] = useState<Recurso | null>(null)
  const [nome, setNome] = useState('')
  const [caps, setCaps] = useState<string[]>([])

  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [de, setDe] = useState(hojeISO())
  const [ate, setAte] = useState(hojeISO(28))
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [blocos, setBlocos] = useState([
    { inicio: 8 * 60, fim: 12 * 60 },
    { inicio: 13 * 60 + 30, fim: 17 * 60 },
  ])
  const [mistura, setMistura] = useState<SlotClass[]>(['STANDARD', 'QUICK', 'EXTENDED'])
  const [gerando, setGerando] = useState(false)
  const [limpando, setLimpando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const [lista, oferta] = await Promise.all([api.consultorios(), api.resumo()])
      setRecursos(lista as Recurso[])
      setResumo(oferta)
      setEscolhidos((atual) =>
        atual.length > 0 ? atual : (lista as Recurso[]).filter((r) => r.ativo).map((r) => r.id),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  function editar(r: Recurso | null) {
    setEditando(
      r ?? { id: '', nome: '', capabilities: [], ativo: true, vagasFuturas: 0, vagasOcupadas: 0 },
    )
    setNome(r?.nome ?? '')
    setCaps(r?.capabilities ?? [])
  }

  async function salvar() {
    if (!editando) return
    try {
      const salvo = await api.salvarConsultorio({
        id: editando.id || undefined,
        nome,
        capabilities: caps,
        ativo: editando.ativo,
      })
      // Sala recém-criada já entra selecionada: quem acabou de criar quer
      // gerar vagas para ela, não caçá-la na lista.
      setEscolhidos((atual) => (atual.includes(salvo.id) ? atual : [...atual, salvo.id]))
      toast.success('Consultório salvo.')
      setEditando(null)
      await recarregar()
      onMudou?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function alternarAtivo(r: Recurso, ativo: boolean) {
    try {
      await api.salvarConsultorio({ id: r.id, nome: r.nome, capabilities: r.capabilities, ativo })
      await recarregar()
      onMudou?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function gerar() {
    setGerando(true)
    try {
      const r = await api.gerarVagas({
        resourceIds: escolhidos,
        de,
        ate,
        diasDaSemana: dias,
        blocos,
        mistura,
      })
      toast.success(
        r.criadas > 0
          ? `${r.criadas} vagas criadas${r.puladas > 0 ? ` · ${r.puladas} já existiam` : ''}.`
          : 'Nenhuma vaga nova: o período escolhido já estava coberto.',
      )
      await recarregar()
      onMudou?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setGerando(false)
    }
  }

  async function limpar() {
    setLimpando(false)
    try {
      const r = await api.limparVagasLivres({ de, ate })
      toast.success(
        `${r.removidas} vagas livres removidas.` +
          (r.preservadas > 0
            ? ` ${r.preservadas} continuam de pé porque têm consulta marcada.`
            : ''),
      )
      await recarregar()
      onMudou?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando a capacidade…
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6 lg:p-8" data-testid="capacidade">
        {/* ── oferta ── */}
        <section>
          <Rotulo>Oferta futura</Rotulo>
          <div className="mt-2 flex flex-wrap gap-2">
            {resumo?.porClasse.length ? (
              resumo.porClasse.map((c) => (
                <div key={c.slotClass} className="rounded-lg border bg-card px-4 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{ROTULO_CLASSE[c.slotClass]}</p>
                  <p className="font-mono text-sm tabular-nums">
                    {c.livres} <span className="text-[11px] text-muted-foreground">livres</span>
                    {c.ocupadas > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {c.ocupadas} marcadas
                      </span>
                    )}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma vaga futura. Gere capacidade abaixo — sem vagas, a recepção não tem o que
                marcar.
              </p>
            )}
          </div>
          {resumo?.ate && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              A agenda vai até {new Date(resumo.ate).toLocaleDateString('pt-BR')}.
            </p>
          )}
        </section>

        {/* ── consultórios ── */}
        <section>
          <div className="flex items-center justify-between gap-2">
            <Rotulo>Consultórios</Rotulo>
            <Button size="sm" variant="outline" onClick={() => editar(null)} data-testid="novo-consultorio">
              <Plus className="size-3.5" /> Novo consultório
            </Button>
          </div>
          <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
            O que a sala tem é o que decide quem cabe nela: o requisito do caso consulta essas
            marcas antes de oferecer a vaga.
          </p>

          <div className="space-y-2">
            {recursos.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3',
                  !r.ativo && 'opacity-60',
                )}
                data-testid="consultorio-item"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.nome}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.capabilities.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">Sem marcas</span>
                    ) : (
                      r.capabilities.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {CAPABILITIES.find((k) => k.id === c)?.rotulo ?? c}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {r.vagasFuturas} vagas futuras · {r.vagasOcupadas} com consulta
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Switch
                      checked={r.ativo}
                      onCheckedChange={(v) => void alternarAtivo(r, v)}
                      aria-label={`Consultório ${r.nome} ativo`}
                    />
                    {r.ativo ? 'Ativo' : 'Inativo'}
                  </label>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => editar(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {editando && (
            <div className="mt-3 space-y-3 rounded-xl border bg-muted/20 p-4">
              <Input
                aria-label="Nome do consultório"
                value={nome}
                placeholder="Consultório 4"
                onChange={(e) => setNome(e.target.value)}
                className="h-9"
              />
              <div className="flex flex-wrap gap-1.5">
                {CAPABILITIES.map((c) => {
                  const marcado = caps.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        setCaps((atual) =>
                          marcado ? atual.filter((x) => x !== c.id) : [...atual, c.id],
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] transition-colors',
                        marcado ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50',
                      )}
                    >
                      {c.rotulo}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvar} disabled={nome.trim().length < 2} data-testid="salvar-consultorio">
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ── geração ── */}
        <section className="rounded-xl border bg-card p-5">
          <Rotulo>Gerar vagas</Rotulo>
          <p className="mb-4 mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Rodar duas vezes o mesmo período não duplica nada: o que já existe é preservado. A
            duração de cada vaga vem da regra de dimensionamento — rápida 20, normal 35, estendida
            50 minutos, mais o intervalo entre elas.
          </p>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[11px] font-medium">Consultórios</p>
              <div className="flex flex-wrap gap-1.5">
                {recursos.map((r) => {
                  const marcado = escolhidos.includes(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!r.ativo}
                      aria-pressed={marcado}
                      onClick={() =>
                        setEscolhidos((atual) =>
                          marcado ? atual.filter((x) => x !== r.id) : [...atual, r.id],
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40',
                        marcado ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50',
                      )}
                    >
                      {r.nome}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium">De</span>
                <Input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="h-9"
                  aria-label="Data inicial"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium">Até</span>
                <Input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="h-9"
                  aria-label="Data final"
                />
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium">Dias da semana</p>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => {
                  const marcado = dias.includes(d.valor)
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        setDias((atual) =>
                          marcado ? atual.filter((x) => x !== d.valor) : [...atual, d.valor],
                        )
                      }
                      className={cn(
                        'w-12 rounded-lg border py-1.5 text-[12px] transition-colors',
                        marcado ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50',
                      )}
                    >
                      {d.rotulo}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium">Períodos de atendimento</p>
              <div className="space-y-2">
                {blocos.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={paraHora(b.inicio)}
                      aria-label={`Início do período ${i + 1}`}
                      onChange={(e) =>
                        setBlocos((atual) =>
                          atual.map((x, j) =>
                            j === i ? { ...x, inicio: paraMinutos(e.target.value) } : x,
                          ),
                        )
                      }
                      className="h-9 w-32"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={paraHora(b.fim)}
                      aria-label={`Fim do período ${i + 1}`}
                      onChange={(e) =>
                        setBlocos((atual) =>
                          atual.map((x, j) =>
                            j === i ? { ...x, fim: paraMinutos(e.target.value) } : x,
                          ),
                        )
                      }
                      className="h-9 w-32"
                    />
                    {blocos.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setBlocos((atual) => atual.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[11px]"
                  onClick={() =>
                    setBlocos((atual) => [...atual, { inicio: 18 * 60, fim: 20 * 60 }])
                  }
                >
                  <Plus className="size-3.5" /> Outro período
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium">Mistura de vagas</p>
              <div className="flex flex-wrap gap-1.5">
                {CLASSES.map((c) => {
                  const marcado = mistura.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        setMistura((atual) =>
                          marcado ? atual.filter((x) => x !== c) : [...atual, c],
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] transition-colors',
                        marcado ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50',
                      )}
                    >
                      {ROTULO_CLASSE[c]}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                As classes se alternam nessa ordem dentro de cada período, e cada consultório
                começa num ponto diferente do ciclo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                onClick={gerar}
                disabled={gerando || escolhidos.length === 0 || mistura.length === 0}
                data-testid="gerar-vagas"
              >
                {gerando ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                Gerar vagas
              </Button>
              <Button variant="outline" onClick={() => setLimpando(true)}>
                <Trash2 className="size-4" /> Limpar vagas livres do período
              </Button>
            </div>
          </div>
        </section>
      </div>

      <AlertDialog open={limpando} onOpenChange={setLimpando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover as vagas livres deste período?</AlertDialogTitle>
            <AlertDialogDescription>
              Some só o que ninguém marcou, de {new Date(`${de}T00:00`).toLocaleDateString('pt-BR')}{' '}
              a {new Date(`${ate}T00:00`).toLocaleDateString('pt-BR')}. Vaga com consulta marcada
              continua de pé — desmarcar alguém é decisão de agenda, com motivo, não faxina de
              capacidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={limpar}>Remover vagas livres</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  )
}
