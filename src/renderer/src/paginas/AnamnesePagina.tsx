import { useMemo, useState } from 'react'
import { ChevronDown, GripVertical, Plus, Search, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { CLASSES, iniciais } from '@/vitrine/dados'
import { CarimboSintetico, Rotulo, TituloTela } from '@/vitrine/pecas'
import {
  CATEGORIAS,
  CICLO,
  ESTADOS_RESPOSTA,
  PROTOCOLO,
  WIDGETS,
  calcular,
  type Bloco,
  type Categoria,
  type EstadoResposta,
} from '@/vitrine/widgets'

let seq = 0
const novo = (tipo: string): Bloco => ({
  id: `b${++seq}`,
  tipo,
  estado: 'NAO_PERGUNTADO',
  quantidade: tipo === 'medications' || tipo === 'diagnoses' ? 0 : undefined,
})

/**
 * S05 — Anamnese de enfermagem.
 *
 * O protocolo nasce inteiro em NÃO PERGUNTADO: nenhum campo tem valor
 * padrão que finja resposta. O requisito à direita recalcula a cada toque.
 */
export function AnamnesePagina() {
  const [blocos, setBlocos] = useState<Bloco[]>(() => PROTOCOLO.map(novo))
  const [paleta, setPaleta] = useState(false)
  const [busca, setBusca] = useState('')

  const req = useMemo(() => calcular(blocos), [blocos])
  const tratados = blocos.filter((b) => b.estado !== 'NAO_PERGUNTADO').length

  const ciclar = (id: string) =>
    setBlocos((bs) =>
      bs.map((b) =>
        b.id === id ? { ...b, estado: CICLO[(CICLO.indexOf(b.estado) + 1) % CICLO.length] } : b,
      ),
    )
  const remover = (id: string) => setBlocos((bs) => bs.filter((b) => b.id !== id))
  const quantidade = (id: string, q: number) =>
    setBlocos((bs) => bs.map((b) => (b.id === id ? { ...b, quantidade: Math.max(0, q) } : b)))
  const adicionar = (tipo: string) => {
    setBlocos((bs) => [...bs, novo(tipo)])
    setPaleta(false)
  }

  const usados = new Set(blocos.map((b) => b.tipo))
  const disponiveis = WIDGETS.filter(
    (w) =>
      !usados.has(w.tipo) &&
      (w.nome.toLowerCase().includes(busca.toLowerCase()) ||
        w.descricao.toLowerCase().includes(busca.toLowerCase())),
  )
  const porCategoria = Object.keys(CATEGORIAS).map((c) => ({
    id: c as Categoria,
    itens: disponiveis.filter((w) => w.categoria === c),
  }))

  const c = CLASSES[req.classe]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Antessala' }, { label: 'Triagem' }, { label: 'Marta R. Alves' }]}
      />

      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <TituloTela
          rotulo="Enfermagem · S05"
          titulo="Anamnese pré-anestésica"
          apoio="O protocolo abre com quinze blocos em não perguntado. Toque no estado de cada bloco para registrar a resposta — campo em branco nunca vira “não”."
          acao={
            <>
              <CarimboSintetico />
              <Button variant="outline" size="sm" onClick={() => setPaleta(true)}>
                <Plus className="size-4" /> Adicionar bloco
              </Button>
            </>
          }
        />

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── composer ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-1">
              <Rotulo>Protocolo pré-anestésico</Rotulo>
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {tratados} / {blocos.length} tratados
              </span>
            </div>

            {blocos.map((b, i) => (
              <CartaoWidget
                key={b.id}
                bloco={b}
                indice={i + 1}
                onCiclar={() => ciclar(b.id)}
                onRemover={() => remover(b.id)}
                onQuantidade={(q) => quantidade(b.id, q)}
              />
            ))}

            <button
              type="button"
              onClick={() => setPaleta(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-4',
                'text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground',
              )}
            >
              <Plus className="size-4" /> Adicionar bloco ao protocolo
            </button>
          </div>

          {/* ── requisito vivo ── */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <Rotulo>Requisito proposto</Rotulo>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  demo-workload-v1
                </span>
              </div>

              <div className={cn('px-5 py-6 transition-colors', req.classe === 'FORA_DA_FAIXA' && 'bg-amber-500/5')}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[52px] font-light leading-none tabular-nums tracking-tight">
                    {req.minutos}
                  </span>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
                <p
                  className={cn(
                    'mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
                    req.classe === 'FORA_DA_FAIXA'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground',
                  )}
                >
                  {req.classe === 'FORA_DA_FAIXA'
                    ? 'Fora da faixa da demonstração'
                    : `Vaga ${c.nome.toLowerCase()} · + ${c.buffer} min`}
                </p>

                <div className="mt-5 space-y-1.5">
                  {req.sinais.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum sinal positivo até agora.
                    </p>
                  )}
                  {req.sinais.map((s, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs">
                      <span className={cn('min-w-0 flex-1 truncate', s.noTeto && 'text-muted-foreground')}>
                        {s.rotulo}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-mono tabular-nums',
                          s.noTeto ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                        )}
                      >
                        {s.noTeto ? 'teto · +0' : `+${s.minutos}`}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                  {req.explicacao}
                </p>
              </div>

              <div className="border-t px-5 py-4">
                {req.incompleto ? (
                  <>
                    <Button className="w-full" disabled>
                      Bloco sem tratamento
                    </Button>
                    <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
                      Todo bloco precisa de um estado antes de publicar. Ausência não vira negativa.
                    </p>
                  </>
                ) : (
                  <>
                    <Button className="w-full">Confirmar e enviar à recepção</Button>
                    <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
                      A recepção recebe duração, recurso e prazo. Nunca o conteúdo clínico.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-[11px] font-semibold">
                {iniciais('Marta Ribeiro Alves')}
              </span>
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">Marta Ribeiro Alves</p>
                <p className="font-mono tabular-nums text-muted-foreground">78 anos · ANT-4A91C2</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {paleta && (
        <Paleta
          grupos={porCategoria}
          busca={busca}
          onBusca={setBusca}
          onFechar={() => setPaleta(false)}
          onAdicionar={adicionar}
        />
      )}
    </div>
  )
}

/** Cartão de bloco: cabeçalho com estado alternável, corpo com os campos reais. */
function CartaoWidget({
  bloco,
  indice,
  onCiclar,
  onRemover,
  onQuantidade,
}: {
  bloco: Bloco
  indice: number
  onCiclar: () => void
  onRemover: () => void
  onQuantidade: (q: number) => void
}) {
  const [aberto, setAberto] = useState(false)
  const def = WIDGETS.find((w) => w.tipo === bloco.tipo)
  if (!def) return null
  const est = ESTADOS_RESPOSTA[bloco.estado]
  const tratado = bloco.estado !== 'NAO_PERGUNTADO'
  const temQuantidade = bloco.quantidade !== undefined && bloco.estado === 'RESPONDIDO'

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card transition-colors',
        tratado ? 'border-border' : 'border-dashed',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/60">
          {String(indice).padStart(2, '0')}
        </span>

        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{def.nome}</span>
            <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
              {def.tipo}@1
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              aberto && 'rotate-180',
            )}
          />
        </button>

        {def.sinal && (
          <Badge variant="outline" className="hidden shrink-0 font-mono text-[10px] sm:inline-flex">
            +{def.minutos}
          </Badge>
        )}

        <button
          type="button"
          onClick={onCiclar}
          title="Alternar estado da resposta"
          className={cn(
            'shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors',
            'hover:bg-accent',
            tratado ? 'border-border' : 'border-dashed',
            est.tom,
          )}
        >
          {est.nome}
        </button>

        <button
          type="button"
          onClick={onRemover}
          title="Remover bloco"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-accent hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {aberto && (
        <div className="border-t px-4 py-3.5 pl-[52px]">
          <p className="text-xs leading-relaxed text-muted-foreground">{def.descricao}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {def.campos.map((c) => (
              <span
                key={c}
                className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {temQuantidade && (
        <div className="flex items-center gap-3 border-t px-4 py-2.5 pl-[52px]">
          <span className="text-xs text-muted-foreground">
            {bloco.tipo === 'medications' ? 'Itens em uso' : 'Diagnósticos ativos'}
          </span>
          <Input
            type="number"
            min={0}
            value={bloco.quantidade}
            onChange={(e) => onQuantidade(Number(e.target.value))}
            className="h-7 w-16 text-center font-mono text-xs tabular-nums"
          />
          <span className="font-mono text-[10.5px] text-muted-foreground">
            limiar {bloco.tipo === 'medications' ? 5 : 3} · +5
          </span>
        </div>
      )}
    </div>
  )
}

/** Gaveta de adicionar bloco, agrupada por categoria. */
function Paleta({
  grupos,
  busca,
  onBusca,
  onFechar,
  onAdicionar,
}: {
  grupos: { id: Categoria; itens: typeof WIDGETS }[]
  busca: string
  onBusca: (v: string) => void
  onFechar: () => void
  onAdicionar: (tipo: string) => void
}) {
  const vazio = grupos.every((g) => g.itens.length === 0)
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <Rotulo>Adicionar ao protocolo</Rotulo>
            <p className="mt-1 text-sm text-muted-foreground">
              Blocos que ainda não estão nesta anamnese
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onFechar}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => onBusca(e.target.value)}
              placeholder="Buscar bloco"
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {vazio && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Todos os blocos disponíveis já estão no protocolo.
            </p>
          )}
          {grupos.map(
            (g) =>
              g.itens.length > 0 && (
                <div key={g.id} className="mb-6">
                  <Rotulo>{CATEGORIAS[g.id].nome}</Rotulo>
                  <div className="mt-2.5 space-y-2">
                    {g.itens.map((w) => (
                      <button
                        key={w.tipo}
                        type="button"
                        onClick={() => onAdicionar(w.tipo)}
                        className="w-full rounded-lg border px-3.5 py-3 text-left transition-colors hover:border-foreground/25 hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {w.nome}
                          </span>
                          {w.sinal && (
                            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                              +{w.minutos}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {w.descricao}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  )
}
