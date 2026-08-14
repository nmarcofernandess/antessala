/**
 * VITRINE — primitivos de widget, no padrão do composer do DietFlow.
 *
 * A anatomia vem de `src/components/ui/widgets/` do DietFlow (HeroValueControl,
 * DataCard, WidgetSection) e foi reconstruída sobre shadcn/ui, que é o sistema
 * deste app. O que se preserva é a gramática: um valor hero grande, métricas
 * secundárias em volta, o controle logo abaixo e uma faixa de status que
 * traduz o número em julgamento — ideal, adequado, atenção, crítico.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'

/* ══════════════ estados semânticos ══════════════ */

export type Status = 'ideal' | 'adequado' | 'atencao' | 'critico' | 'neutro'

export const STATUS: Record<
  Status,
  { nome: string; texto: string; fundo: string; borda: string; ponto: string; cor: string }
> = {
  ideal: {
    nome: 'Ideal',
    texto: 'text-success',
    fundo: 'bg-success/10',
    borda: 'border-success/30',
    ponto: 'bg-success',
    cor: 'var(--color-success)',
  },
  adequado: {
    nome: 'Adequado',
    texto: 'text-primary',
    fundo: 'bg-primary/10',
    borda: 'border-primary/25',
    ponto: 'bg-primary',
    cor: 'var(--color-primary)',
  },
  atencao: {
    nome: 'Atenção',
    texto: 'text-warning',
    fundo: 'bg-warning/10',
    borda: 'border-warning/30',
    ponto: 'bg-warning',
    cor: 'var(--color-warning)',
  },
  critico: {
    nome: 'Crítico',
    texto: 'text-destructive',
    fundo: 'bg-destructive/10',
    borda: 'border-destructive/30',
    ponto: 'bg-destructive',
    cor: 'var(--color-destructive)',
  },
  neutro: {
    nome: '—',
    texto: 'text-muted-foreground',
    fundo: 'bg-muted',
    borda: 'border-border',
    ponto: 'bg-muted-foreground',
    cor: 'var(--color-muted-foreground)',
  },
}

/** Chip de status. Cor é dado — nunca decoração. */
export function ChipStatus({
  status,
  children,
  className,
}: {
  status: Status
  children?: ReactNode
  className?: string
}) {
  const s = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[11px] font-medium',
        s.fundo,
        s.borda,
        s.texto,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', s.ponto)} aria-hidden />
      {children ?? s.nome}
    </span>
  )
}

/* ══════════════ estrutura ══════════════ */

/** Corpo do widget: empilha as seções com respiro constante. */
export function CorpoWidget({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>
}

/** Grade de cartões de dado. Duas colunas por padrão, uma no estreito. */
export function GradeDados({
  children,
  colunas = 2,
  className,
}: {
  children: ReactNode
  colunas?: 2 | 3
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        colunas === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Etiqueta de subseção dentro do widget. */
export function EtiquetaSecao({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  )
}

/* ══════════════ valor hero ══════════════ */

/**
 * Valor principal do widget: número grande, unidade, métricas derivadas e
 * o controle logo abaixo. É o que o DietFlow chama de HeroValueControl.
 */
export function ValorHero({
  valor,
  unidade,
  metricas,
  status = 'neutro',
  acao,
  children,
  className,
}: {
  valor: ReactNode
  unidade?: string
  metricas?: ReactNode
  status?: Status
  acao?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const s = STATUS[status]
  return (
    <div
      className={cn(
        'rounded-xl border bg-muted/30 px-5 py-4',
        status !== 'neutro' && s.borda,
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2.5">
          <span
            className={cn(
              'font-mono text-[42px] font-light leading-none tabular-nums',
              status === 'neutro' ? 'text-foreground' : s.texto,
            )}
          >
            {valor}
          </span>
          {unidade && <span className="text-base text-muted-foreground">{unidade}</span>}
          {metricas && (
            <span className="flex items-baseline gap-2 pl-1">
              <span className="text-border">·</span>
              {metricas}
            </span>
          )}
        </div>
        {acao && <div className="flex items-center gap-2">{acao}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

/** Métrica secundária ao lado do valor hero. */
export function Metrica({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone?: LucideIcon
  valor: ReactNode
  rotulo: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      {Icone && <Icone className="size-3.5" />}
      <span className="font-mono tabular-nums">{valor}</span>
      <span>{rotulo}</span>
    </span>
  )
}

/** Slider tingido pelo status — o número e a cor mudam juntos. */
export function SliderStatus({
  valor,
  min,
  max,
  passo = 1,
  marcas,
  status = 'adequado',
  onChange,
  rotuloA11y,
}: {
  valor: number
  min: number
  max: number
  passo?: number
  marcas?: (number | { valor: number; rotulo: string })[]
  status?: Status
  onChange: (v: number) => void
  rotuloA11y: string
}) {
  const normalizadas = marcas?.map((m) =>
    typeof m === 'number' ? { valor: m, rotulo: String(m) } : m,
  )
  return (
    <div className="w-full" style={{ ['--tom-slider' as string]: STATUS[status].cor }}>
      <Slider
        aria-label={rotuloA11y}
        value={[valor]}
        min={min}
        max={max}
        step={passo}
        onValueChange={([v]) => onChange(v)}
      />
      {normalizadas && (
        <div className="relative mt-2 h-4">
          {normalizadas.map((m) => (
            <span
              key={m.valor}
              className="absolute -translate-x-1/2 font-mono text-[10px] tabular-nums text-muted-foreground"
              style={{ left: `${((m.valor - min) / (max - min)) * 100}%` }}
            >
              {m.rotulo}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════ cartão de dado ══════════════ */

/**
 * Cartão pequeno com ícone, título, valor e um rodapé que explica o valor.
 * É a peça que dá densidade ao widget sem virar formulário.
 */
export function CartaoDado({
  icone: Icone,
  titulo,
  valor,
  unidade,
  status,
  rodape,
  children,
  className,
}: {
  icone?: LucideIcon
  titulo: string
  valor?: ReactNode
  unidade?: string
  status?: Status
  rodape?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const s = status ? STATUS[status] : null
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-card px-4 py-3',
        s && status !== 'neutro' && s.borda,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icone && (
          <Icone className={cn('size-3.5 shrink-0', s ? s.texto : 'text-muted-foreground')} />
        )}
        <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      </div>

      {valor !== undefined && (
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-mono text-xl font-medium tabular-nums',
              s && status !== 'neutro' ? s.texto : 'text-foreground',
            )}
          >
            {valor}
          </span>
          {unidade && <span className="text-xs text-muted-foreground">{unidade}</span>}
        </div>
      )}

      {children && <div className="mt-2">{children}</div>}

      {rodape && (
        <div className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {rodape}
        </div>
      )}
    </div>
  )
}

/* ══════════════ escolha ══════════════ */

export type Opcao<T extends string | number> = {
  valor: T
  rotulo: string
  detalhe?: string
  status?: Status
}

/**
 * Lista de opções mutuamente exclusivas — o Likert do DietFlow.
 * Cada opção carrega seu próprio status, então a resposta já se classifica.
 */
export function Escolha<T extends string | number>({
  opcoes,
  valor,
  onChange,
  colunas,
  className,
}: {
  opcoes: Opcao<T>[]
  valor: T | undefined
  onChange: (v: T) => void
  colunas?: 2 | 3 | 4 | 5
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        colunas === 2 && 'sm:grid-cols-2',
        colunas === 3 && 'sm:grid-cols-3',
        colunas === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        colunas === 5 && 'sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
    >
      {opcoes.map((o) => {
        const ativo = valor === o.valor
        const s = o.status ? STATUS[o.status] : null
        return (
          <button
            key={String(o.valor)}
            type="button"
            onClick={() => onChange(o.valor)}
            aria-pressed={ativo}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
              ativo
                ? s
                  ? cn(s.fundo, s.borda)
                  : 'border-foreground/25 bg-accent'
                : 'hover:bg-accent/50',
            )}
          >
            {s && (
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full transition-opacity',
                  s.ponto,
                  !ativo && 'opacity-25',
                )}
                aria-hidden
              />
            )}
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[13px] leading-tight',
                  ativo ? cn('font-medium', s?.texto) : 'text-foreground',
                )}
              >
                {o.rotulo}
              </span>
              {o.detalhe && (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{o.detalhe}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Escala visual de N passos — a régua do Bristol. Cada passo é um degrau
 * clicável com seu próprio tom, e o selecionado ganha altura.
 */
export function Regua<T extends number>({
  passos,
  valor,
  onChange,
  className,
}: {
  passos: { valor: T; rotulo: string; detalhe?: string; status: Status }[]
  valor: T | undefined
  onChange: (v: T) => void
  className?: string
}) {
  const atual = passos.find((p) => p.valor === valor)
  return (
    <div className={className}>
      <div className="flex items-end gap-1">
        {passos.map((p) => {
          const ativo = p.valor === valor
          const s = STATUS[p.status]
          return (
            <button
              key={p.valor}
              type="button"
              onClick={() => onChange(p.valor)}
              title={p.rotulo}
              aria-pressed={ativo}
              className={cn(
                'group relative flex-1 rounded-md border transition-all',
                ativo ? cn(s.fundo, s.borda, 'h-14') : 'h-10 hover:bg-accent/60',
              )}
            >
              <span
                className={cn(
                  'absolute inset-x-0 bottom-0 rounded-b-[5px] transition-all',
                  s.ponto,
                  ativo ? 'h-1.5 opacity-100' : 'h-1 opacity-30 group-hover:opacity-60',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'font-mono text-xs tabular-nums transition-colors',
                  ativo ? cn('font-medium', s.texto) : 'text-muted-foreground',
                )}
              >
                {p.valor}
              </span>
            </button>
          )
        })}
      </div>
      {atual && (
        <p className="mt-2.5 text-[13px]">
          <span className={cn('font-medium', STATUS[atual.status].texto)}>{atual.rotulo}</span>
          {atual.detalhe && <span className="text-muted-foreground"> · {atual.detalhe}</span>}
        </p>
      )}
    </div>
  )
}

/* ══════════════ score ══════════════ */

/**
 * Barra de score com faixas nomeadas. Mostra onde o número caiu dentro da
 * escala inteira, não só o número — é o que torna um score legível.
 */
export function BarraScore({
  valor,
  max,
  faixas,
  className,
}: {
  valor: number
  max: number
  faixas: { ate: number; nome: string; status: Status }[]
  className?: string
}) {
  const faixa = faixas.find((f) => valor <= f.ate) ?? faixas[faixas.length - 1]
  const s = STATUS[faixa.status]

  return (
    <div className={className}>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {faixas.map((f, i) => {
          const inicio = i === 0 ? 0 : faixas[i - 1].ate
          const largura = ((f.ate - inicio) / max) * 100
          const ativa = f === faixa
          return (
            <span
              key={f.nome}
              className={cn(
                'transition-opacity',
                STATUS[f.status].ponto,
                ativa ? 'opacity-100' : 'opacity-20',
              )}
              style={{ width: `${largura}%` }}
              aria-hidden
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className={cn('text-[13px] font-medium', s.texto)}>{faixa.nome}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {valor} de {max}
        </span>
      </div>
    </div>
  )
}
