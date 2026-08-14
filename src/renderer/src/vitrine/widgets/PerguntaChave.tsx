/**
 * A pergunta que abre um widget — e a peça que faz a revelação acontecer.
 *
 * Toda a cascata da anamnese depende de uma distinção que a maioria dos
 * formulários perde: “não” e “ninguém perguntou” não são a mesma coisa. Aqui
 * elas são botões diferentes, e só o “sim” abre o que vem depois.
 */

import type { ReactNode } from 'react'
import { Check, HelpCircle, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS, type Status } from '../primitivos'
import type { EstadoResposta, Resposta } from './tipos'

type Alternativa = {
  chave: string
  rotulo: string
  icone: typeof Check
  estado: EstadoResposta
  valor?: boolean
  status: Status
}

const ALTERNATIVAS: Alternativa[] = [
  { chave: 'sim', rotulo: 'Sim', icone: Check, estado: 'RESPONDIDO', valor: true, status: 'atencao' },
  { chave: 'nao', rotulo: 'Não', icone: X, estado: 'RESPONDIDO', valor: false, status: 'ideal' },
  { chave: 'nao_sabe', rotulo: 'Não sabe', icone: HelpCircle, estado: 'NAO_SABE', status: 'neutro' },
  { chave: 'recusou', rotulo: 'Preferiu não responder', icone: Minus, estado: 'RECUSOU', status: 'neutro' },
]

export function PerguntaChave({
  pergunta,
  apoio,
  resposta,
  onChange,
  statusQuandoSim = 'atencao',
  compacta,
  children,
}: {
  pergunta: string
  apoio?: string
  resposta: Resposta<boolean>
  onChange: (r: Resposta<boolean>) => void
  /** Nem todo sim é ruim: “tem acompanhante?” positivo é bom. */
  statusQuandoSim?: Status
  /** Versão em linha, para as perguntas satélite dentro de um widget. */
  compacta?: boolean
  children?: ReactNode
}) {
  const selecionada = ALTERNATIVAS.find(
    (a) => a.estado === resposta.estado && a.valor === resposta.valor,
  )

  const tomDe = (a: Alternativa): Status =>
    a.chave === 'sim' ? statusQuandoSim : a.chave === 'nao' ? 'ideal' : 'neutro'

  if (compacta) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-2.5 first:border-t-0 first:pt-0">
        <span className="min-w-0 text-[13px]">{pergunta}</span>
        <div className="flex shrink-0 items-center gap-1">
          {ALTERNATIVAS.slice(0, 3).map((a) => {
            const ativa = selecionada?.chave === a.chave
            const s = STATUS[tomDe(a)]
            return (
              <button
                key={a.chave}
                type="button"
                onClick={() => onChange({ estado: a.estado, valor: a.valor })}
                aria-pressed={ativa}
                title={a.rotulo}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  ativa ? cn(s.fundo, s.borda, s.texto) : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {a.rotulo}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium leading-snug">{pergunta}</p>
      {apoio && <p className="mt-1 max-w-[70ch] text-xs text-muted-foreground">{apoio}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {ALTERNATIVAS.map((a) => {
          const ativa = selecionada?.chave === a.chave
          const s = STATUS[tomDe(a)]
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => onChange({ estado: a.estado, valor: a.valor })}
              aria-pressed={ativa}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
                ativa
                  ? cn(s.fundo, s.borda, s.texto, 'font-medium')
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <a.icone className="size-3.5" />
              {a.rotulo}
            </button>
          )
        })}
      </div>

      {children}
    </div>
  )
}
