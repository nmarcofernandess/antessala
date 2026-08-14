/**
 * VITRINE — peças visuais compartilhadas pelas quatro telas.
 *
 * Densidade clínica: hairline, tabular-nums, hierarquia por peso e não por cor.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CLASSES, type ClasseVaga, iniciais } from './dados'

/** Etiqueta de seção em versalete monoespaçado. */
export function Rotulo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Cabeçalho de tela: título grande + linha de apoio. */
export function TituloTela({
  rotulo,
  titulo,
  apoio,
  acao,
}: {
  rotulo: string
  titulo: string
  apoio?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="min-w-0">
        <Rotulo>{rotulo}</Rotulo>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{titulo}</h1>
        {apoio && <p className="mt-1.5 max-w-[62ch] text-sm text-muted-foreground">{apoio}</p>}
      </div>
      {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
    </div>
  )
}

/** Selo da classe de vaga. Cor é dado, não decoração. */
export function SeloClasse({
  classe,
  minutos,
  compacto,
}: {
  classe: ClasseVaga
  minutos?: number
  compacto?: boolean
}) {
  const c = CLASSES[classe]
  const total = minutos ?? c.minutos
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
        'font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] tabular-nums',
        c.tom,
      )}
    >
      <span className={cn('size-1.5 rounded-full', c.ponto)} aria-hidden />
      {compacto ? c.nome : `${c.nome} · ${total} + ${c.buffer}`}
    </span>
  )
}

/** Avatar circular com iniciais — sem foto, porque não há pessoa real. */
export function Inicial({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full',
        'bg-muted text-[11px] font-semibold tracking-wide text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  )
}

/** Linha de dado com liderança pontilhada, como formulário impresso. */
export function LinhaDado({
  rotulo,
  detalhe,
  valor,
  destaque,
}: {
  rotulo: string
  detalhe?: string
  valor: ReactNode
  destaque?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 border-t py-2.5 text-sm first:border-t-0 first:pt-0">
      <span className="min-w-0">
        <span className="text-foreground">{rotulo}</span>
        {detalhe && <span className="mt-0.5 block text-xs text-muted-foreground">{detalhe}</span>}
      </span>
      <span className="mt-[-4px] min-w-4 flex-1 border-b border-dotted border-border" aria-hidden />
      <span
        className={cn(
          'shrink-0 font-mono text-sm tabular-nums',
          destaque ? 'font-medium text-foreground' : 'text-muted-foreground',
        )}
      >
        {valor}
      </span>
    </div>
  )
}

/** Carimbo de demonstração. Aparece em toda tela que mostra caso. */
export function CarimboSintetico({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block -rotate-1 border border-destructive/60 px-2 py-1',
        'font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-destructive/90',
        className,
      )}
    >
      Dados sintéticos
    </span>
  )
}
