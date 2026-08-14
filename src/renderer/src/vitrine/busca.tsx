/**
 * VITRINE — campo de busca sobre os catálogos reais.
 *
 * O mesmo componente serve alergia a medicamento, medicação em uso e
 * diagnóstico: muda a fonte, não a mecânica. Digitar um nome comercial encontra
 * o princípio ativo, porque é assim que o paciente fala — ele diz "Glifage",
 * não "cloridrato de metformina".
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type Resultado = {
  id: string
  titulo: string
  /** Linha de apoio: classe terapêutica, capítulo do CID, categoria MET. */
  apoio?: string
  /** Pista de por que este resultado apareceu — o apelido que bateu. */
  pista?: string
  /** Código curto exibido em mono à direita. */
  codigo?: string
}

export function BuscaCatalogo({
  placeholder,
  buscar,
  onEscolher,
  rodape,
  autoFocus,
  className,
}: {
  placeholder: string
  buscar: (termo: string) => Resultado[]
  onEscolher: (r: Resultado) => void
  /** Texto fixo abaixo do campo — normalmente o tamanho real do catálogo. */
  rodape?: string
  autoFocus?: boolean
  className?: string
}) {
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)

  const resultados = useMemo(() => buscar(termo), [termo, buscar])

  useEffect(() => setIndice(0), [termo])

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const escolher = (r: Resultado) => {
    onEscolher(r)
    setTermo('')
    setAberto(false)
  }

  const mostrar = aberto && termo.trim().length >= 2

  return (
    <div ref={caixa} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={termo}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setTermo(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (!mostrar || resultados.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndice((i) => (i + 1) % resultados.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndice((i) => (i - 1 + resultados.length) % resultados.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            escolher(resultados[indice])
          } else if (e.key === 'Escape') {
            setAberto(false)
          }
        }}
        className={cn('pl-9', termo && 'pr-9')}
      />
      {termo && (
        <button
          type="button"
          onClick={() => setTermo('')}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      )}

      {mostrar && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nada encontrado para “{termo}”.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {resultados.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => escolher(r)}
                    className={cn(
                      'flex w-full items-baseline gap-3 px-3 py-2 text-left transition-colors',
                      i === indice && 'bg-accent',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.titulo}</span>
                      {(r.apoio || r.pista) && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {r.pista && (
                            <span className="text-foreground/70">apelido: {r.pista}</span>
                          )}
                          {r.pista && r.apoio && ' · '}
                          {r.apoio}
                        </span>
                      )}
                    </span>
                    {r.codigo && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {r.codigo}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rodape && (
            <p className="border-t bg-muted/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {rodape}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
