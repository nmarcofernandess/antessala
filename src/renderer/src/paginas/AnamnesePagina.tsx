import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, GripVertical, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { CarimboSintetico, Rotulo, TituloTela } from '@/vitrine/pecas'
import { TAMANHO_CATALOGOS } from '@/vitrine/catalogos'
import {
  CATEGORIAS,
  PACIENTE,
  WIDGETS,
  widgetPorTipo,
  type Bloco,
  type Categoria,
  type DefWidget,
} from '@/vitrine/widgets/registro'
import {
  PROTOCOLO_GERAL,
  acrescentarFaltantes,
  aplicar,
  protocoloPara,
  type Protocolo,
} from '@/vitrine/widgets/protocolos'
import { carregarProtocolos, useProtocolos } from '@/vitrine/protocolos-store'
import { BASE_MINUTOS, CLASSES, calcularRequisito } from '@/vitrine/widgets/requisito'

/**
 * S05 — Anamnese pré-anestésica.
 *
 * O protocolo do procedimento decide quais blocos abrem, e a coluna da direita
 * traduz ao vivo o que foi respondido em uma necessidade de agenda. A regra de
 * minutos é a mesma que roda no processo principal: base de vinte, teto de três
 * domínios e a acomodação somando por fora. O que muda com o protocolo é a
 * completude — só o que ele pede precisa estar tratado para publicar.
 */
export function AnamnesePagina() {
  // A composição vem de onde ela é editada: da tabela no app, da fixture fora
  // dele. Montar o caso antes disso abriria uma entrevista que a configuração
  // já mudou.
  const { protocolos, carregando } = useProtocolos()
  const [protocolo, setProtocolo] = useState<Protocolo | null>(null)
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [abertos, setAbertos] = useState<string[]>([])
  const [paletaAberta, setPaletaAberta] = useState(false)
  const [trocaPendente, setTrocaPendente] = useState<Protocolo | null>(null)

  useEffect(() => {
    void carregarProtocolos()
  }, [])

  useEffect(() => {
    if (carregando || protocolo) return
    const escolhido = protocoloPara(PACIENTE.procedimento, protocolos)
    const novos = aplicar(escolhido)
    setProtocolo(escolhido)
    setBlocos(novos)
    setAbertos(novos.filter((b) => b.tipo === 'allergies').map((b) => b.id))
  }, [carregando, protocolo, protocolos])

  const requisito = useMemo(
    () => calcularRequisito(blocos, protocolo ?? PROTOCOLO_GERAL),
    [blocos, protocolo],
  )
  const classe = CLASSES[requisito.classe]

  /** Troca de protocolo: com o caso já montado, a pessoa escolhe o que fazer. */
  const pedirTroca = (p: Protocolo) => {
    if (p.id === protocolo?.id) return
    if (blocos.length === 0) {
      setProtocolo(p)
      setBlocos(aplicar(p))
      return
    }
    setTrocaPendente(p)
  }

  const substituir = (p: Protocolo) => {
    setProtocolo(p)
    const novos = aplicar(p)
    setBlocos(novos)
    setAbertos(novos.slice(0, 1).map((b) => b.id))
    setTrocaPendente(null)
  }

  const acrescentar = (p: Protocolo) => {
    setProtocolo(p)
    setBlocos((bs) => acrescentarFaltantes(p, bs))
    setTrocaPendente(null)
  }

  const alterar = (id: string, dados: unknown) =>
    setBlocos((bs) => bs.map((b) => (b.id === id ? { ...b, dados } : b)))

  const adicionar = (def: DefWidget) => {
    const id = `${def.tipo}_${Date.now()}`
    setBlocos((bs) => [...bs, { id, tipo: def.tipo, dados: def.dadosIniciais() }])
    setAbertos((a) => [...a, id])
    setPaletaAberta(false)
  }

  const alternar = (id: string) =>
    setAbertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const usados = new Set(blocos.map((b) => b.tipo))

  if (!protocolo) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Carregando o protocolo do procedimento…
      </div>
    )
  }

  const tratados = protocolo.blocos.length - requisito.pendentes.length
  /** Blocos que a pessoa acrescentou além do que o protocolo pede. */
  const extras = blocos.filter((b) => !protocolo.blocos.includes(b.tipo)).length

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Antessala' }, { label: 'Triagem' }, { label: PACIENTE.nome }]}
      />

      <div className="mx-auto w-full max-w-[1400px] p-6 lg:p-8">
        <TituloTela
          rotulo="Enfermagem · S05"
          titulo="Anamnese pré-anestésica"
          apoio="Cada bloco pergunta uma coisa e revela o resto conforme a resposta. Campo em branco nunca vira “não”: a negativa é uma resposta que alguém ouviu e registrou."
          acao={
            <>
              <CarimboSintetico />
              <Button variant="outline" size="sm" onClick={() => setPaletaAberta(true)}>
                <Plus className="size-4" />
                Adicionar bloco
              </Button>
            </>
          }
        />

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── composer ── */}
          <div>
            <CabecalhoProtocolo
              protocolo={protocolo}
              opcoes={protocolos}
              tratados={tratados}
              extras={extras}
              onTrocar={pedirTroca}
            />

            <div className="space-y-2.5">
              {blocos.map((bloco, i) => (
                <CartaoBloco
                  key={bloco.id}
                  indice={i + 1}
                  bloco={bloco}
                  aberto={abertos.includes(bloco.id)}
                  onAlternar={() => alternar(bloco.id)}
                  onAlterar={(d) => alterar(bloco.id, d)}
                  onRemover={() => setBlocos((bs) => bs.filter((b) => b.id !== bloco.id))}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPaletaAberta(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent/40"
            >
              <Plus className="size-4" />
              Adicionar bloco ao protocolo
            </button>
          </div>

          {/* ── requisito ao vivo ── */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <Rotulo>Requisito proposto</Rotulo>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  demo-workload-v1
                </span>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[52px] font-light leading-none tabular-nums">
                    {requisito.minutos}
                  </span>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>

                <div
                  className={cn(
                    'mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1',
                    'font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
                    classe.tom,
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', classe.ponto)} aria-hidden />
                  {classe.nome} · + {classe.buffer} min
                </div>

                <div className="mt-4 space-y-2">
                  <LinhaSinal rotulo="Base da consulta" minutos={BASE_MINUTOS} />
                  {requisito.sinais.map((s, i) => (
                    <LinhaSinal
                      key={`${s.rotulo}_${i}`}
                      rotulo={s.rotulo}
                      origem={s.origem}
                      minutos={s.minutos}
                      noTeto={s.noTeto}
                    />
                  ))}
                </div>

                <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                  {requisito.explicacao} O teto de três domínios existe porque a entrevista não
                  cresce sem fim com a lista de queixas.
                </p>

                {requisito.classe === 'FORA_DA_FAIXA' && (
                  <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed">
                    Passou de 50 minutos, e a regra não trunca o resultado para caber. Este caso
                    sai da sugestão automática e vai para definição humana — o sistema prefere
                    admitir o próprio limite a inventar uma vaga que não serve.
                  </p>
                )}
              </div>

              <div className="border-t px-5 py-4">
                <Button className="w-full" disabled={requisito.pendentes.length > 0}>
                  {requisito.pendentes.length > 0
                    ? `Faltam ${requisito.pendentes.length} blocos`
                    : 'Publicar para a recepção'}
                </Button>
                {requisito.pendentes.length > 0 && (
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                    Aguardando resposta: {requisito.pendentes.join(', ')}.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
                  MA
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{PACIENTE.nome}</p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {PACIENTE.idade} anos · {PACIENTE.codigo}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                {PACIENTE.procedimento} · {PACIENTE.servico}
                <br />
                {PACIENTE.solicitante}
              </p>
            </div>

            <div className="rounded-xl border border-dashed px-5 py-4">
              <Rotulo>Catálogos embarcados</Rotulo>
              <div className="mt-2.5 space-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                <p>{TAMANHO_CATALOGOS.cid.toLocaleString('pt-BR')} categorias CID-10</p>
                <p>
                  {TAMANHO_CATALOGOS.medicamentos} medicamentos ·{' '}
                  {TAMANHO_CATALOGOS.comerciais.toLocaleString('pt-BR')} apelidos
                </p>
                <p>{TAMANHO_CATALOGOS.met} atividades com MET de referência</p>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                Tudo local. A busca funciona com o cabo de rede na mão.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {paletaAberta && (
        <Paleta usados={usados} onEscolher={adicionar} onFechar={() => setPaletaAberta(false)} />
      )}

      {trocaPendente && (
        <DialogoTroca
          destino={trocaPendente}
          atual={protocolo}
          blocosAtuais={blocos}
          onSubstituir={() => substituir(trocaPendente)}
          onAcrescentar={() => acrescentar(trocaPendente)}
          onCancelar={() => setTrocaPendente(null)}
        />
      )}
    </div>
  )
}

/* ══════════════ cabeçalho do protocolo ══════════════ */

function CabecalhoProtocolo({
  protocolo,
  opcoes,
  tratados,
  extras,
  onTrocar,
}: {
  protocolo: Protocolo
  opcoes: Protocolo[]
  tratados: number
  extras: number
  onTrocar: (p: Protocolo) => void
}) {
  const total = protocolo.blocos.length

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Rotulo>Protocolo salvo · v{protocolo.versao}</Rotulo>
          <p className="mt-1 text-sm font-medium">{protocolo.nome}</p>
          <p className="text-[11.5px] text-muted-foreground">{protocolo.regime}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {tratados} / {total} tratados
            {extras > 0 && ` · ${extras} complementar${extras > 1 ? 'es' : ''}`}
          </span>
          <Select value={protocolo.id} onValueChange={(v) => {
            const p = opcoes.find((x) => x.id === v)
            if (p) onTrocar(p)
          }}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {p.blocos.length}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progresso do protocolo: o traço cresce com o que já foi perguntado. */}
      <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60 transition-all duration-500"
          style={{ width: `${total ? (tratados / total) * 100 : 0}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Composição de coleta desta demonstração, gerenciada em{' '}
        <Link to="/repertorio" className="underline underline-offset-2 hover:text-foreground">
          Repertório › Protocolos
        </Link>
        . Nenhuma instituição validou esta lista: ela decide quais perguntas o formulário faz,
        nunca o que o paciente tem.
      </p>
    </div>
  )
}

/* ══════════════ troca de protocolo ══════════════ */

function DialogoTroca({
  destino,
  atual,
  blocosAtuais,
  onSubstituir,
  onAcrescentar,
  onCancelar,
}: {
  destino: Protocolo
  atual: Protocolo
  blocosAtuais: Bloco[]
  onSubstituir: () => void
  onAcrescentar: () => void
  onCancelar: () => void
}) {
  const presentes = new Set(blocosAtuais.map((b) => b.tipo))
  const faltantes = destino.blocos.filter((t) => !presentes.has(t)).length

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <button
        type="button"
        aria-label="Cancelar troca"
        onClick={onCancelar}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative w-full max-w-md rounded-xl border bg-background p-5 shadow-xl">
        <Rotulo>Trocar de protocolo</Rotulo>
        <p className="mt-2 text-sm leading-relaxed">
          O caso está com <strong>{atual.nome}</strong> e {blocosAtuais.length} blocos. Aplicar{' '}
          <strong>{destino.nome}</strong> pode ser feito de duas formas.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onAcrescentar}
            className="w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="block text-[13px] font-medium">
              Acrescentar os que faltam
            </span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              Traz {faltantes} {faltantes === 1 ? 'bloco novo' : 'blocos novos'} e mantém tudo o
              que já foi respondido.
            </span>
          </button>

          <button
            type="button"
            onClick={onSubstituir}
            className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left transition-colors hover:bg-destructive/10"
          >
            <span className="block text-[13px] font-medium text-destructive">
              Substituir a composição
            </span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              Abre os {destino.blocos.length} blocos do protocolo novo. As respostas atuais são
              descartadas.
            </span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════ cartão de bloco ══════════════ */

function CartaoBloco({
  indice,
  bloco,
  aberto,
  onAlternar,
  onAlterar,
  onRemover,
}: {
  indice: number
  bloco: Bloco
  aberto: boolean
  onAlternar: () => void
  onAlterar: (d: unknown) => void
  onRemover: () => void
}) {
  const def = widgetPorTipo(bloco.tipo)
  if (!def) return null

  const dados = bloco.dados as never
  const tratado = def.tratado(dados)
  const Componente = def.Componente as unknown as ComponentType<{
    dados: unknown
    onChange: (d: unknown) => void
  }>
  const Icone = def.icone

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-xl border bg-card transition-all duration-200',
        !tratado && 'border-dashed',
        aberto && 'border-foreground/15 shadow-sm',
      )}
    >
      <div className={cn('flex items-center gap-3 px-4 py-3', aberto && 'bg-muted/30')}>
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {String(indice).padStart(2, '0')}
        </span>
        <Icone className="size-4 shrink-0 text-muted-foreground" />

        <button
          type="button"
          onClick={onAlternar}
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 text-left"
        >
          <span className="shrink-0 text-sm font-medium">{def.nome}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {tratado ? def.resumo(dados) : def.descricao}
          </span>
        </button>

        {!tratado && (
          <span className="shrink-0 rounded-full border border-dashed px-2 py-0.5 text-[10.5px] text-muted-foreground">
            aguarda resposta
          </span>
        )}

        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${def.nome}`}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={onAlternar}
          aria-label={aberto ? 'Fechar bloco' : 'Abrir bloco'}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronDown className={cn('size-4 transition-transform', aberto && 'rotate-180')} />
        </button>
      </div>

      {aberto && (
        <div className="border-t bg-muted/20 px-5 py-4">
          <Componente dados={bloco.dados} onChange={onAlterar} />
        </div>
      )}
    </div>
  )
}

function LinhaSinal({
  rotulo,
  origem,
  minutos,
  noTeto,
}: {
  rotulo: string
  origem?: string
  minutos: number
  noTeto?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className={cn('min-w-0 flex-1', noTeto && 'text-muted-foreground')}>
        <span className="block truncate">{rotulo}</span>
        {origem && (
          <span className="block truncate text-[11px] text-muted-foreground">{origem}</span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-[11px] tabular-nums',
          noTeto ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {noTeto ? 'teto · +0' : `+${minutos}`}
      </span>
    </div>
  )
}

/* ══════════════ paleta ══════════════ */

function Paleta({
  usados,
  onEscolher,
  onFechar,
}: {
  usados: Set<string>
  onEscolher: (d: DefWidget) => void
  onFechar: () => void
}) {
  const [busca, setBusca] = useState('')

  const lista = WIDGETS.filter(
    (w) =>
      w.nome.toLowerCase().includes(busca.toLowerCase()) ||
      w.descricao.toLowerCase().includes(busca.toLowerCase()),
  )

  const porCategoria = (Object.keys(CATEGORIAS) as Categoria[])
    .map((c) => ({ categoria: c, itens: lista.filter((w) => w.categoria === c) }))
    .filter((g) => g.itens.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar paleta"
        onClick={onFechar}
        className="absolute inset-0 bg-black/25"
      />

      <div className="relative flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <Rotulo>Blocos disponíveis</Rotulo>
            <p className="mt-1 text-sm text-muted-foreground">
              Os quatorze blocos da anamnese pré-anestésica.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar bloco"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {porCategoria.map((g) => (
            <div key={g.categoria} className="mb-5">
              <Rotulo>{CATEGORIAS[g.categoria]}</Rotulo>
              <div className="mt-2 space-y-1.5">
                {g.itens.map((w) => {
                  const jaUsado = usados.has(w.tipo)
                  const Icone = w.icone
                  return (
                    <button
                      key={w.tipo}
                      type="button"
                      onClick={() => onEscolher(w)}
                      className="flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[13px] font-medium">{w.nome}</span>
                          {jaUsado && (
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              no protocolo
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                          {w.descricao}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {lista.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum bloco com esse nome.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
