import { useState, type ComponentType } from 'react'
import { ChevronDown } from 'lucide-react'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { Rotulo, TituloTela } from '@/vitrine/pecas'
import { WIDGETS_DIETFLOW, type DefWidgetDietFlow } from '@/vitrine/widgets/registroDietFlow'

/**
 * Repertório de widgets herdado do DietFlow.
 *
 * A tela existe para mostrar de onde vem o vocabulário do composer. Os widgets
 * são nutricionais, não pré-anestésicos — o que se transporta é a forma de
 * perguntar: uma escala que se lê de relance, um score que se explica sozinho,
 * uma meta que aparece ao lado do valor em vez de num manual.
 */
export function RepertorioPagina() {
  const [abertos, setAbertos] = useState<string[]>(['sono', 'bristol'])

  const alternar = (tipo: string) =>
    setAbertos((a) => (a.includes(tipo) ? a.filter((x) => x !== tipo) : [...a, tipo]))

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Repertório de widgets' }]} />

      <div className="mx-auto w-full max-w-4xl p-6 lg:p-8">
        <TituloTela
          rotulo="Composer · herança"
          titulo="Repertório do DietFlow"
          apoio="Os oito widgets do composer clínico do DietFlow, com respostas reais de uma consulta nutricional. É daqui que vem a gramática usada na anamnese pré-anestésica: escala que se lê de relance, score que se explica sozinho, meta ao lado do valor."
        />

        <div className="mt-7 space-y-2.5">
          {WIDGETS_DIETFLOW.map((w) => (
            <CartaoRepertorio
              key={w.tipo}
              def={w}
              aberto={abertos.includes(w.tipo)}
              onAlternar={() => alternar(w.tipo)}
            />
          ))}
        </div>

        <p className="mt-8 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
          Nenhum destes blocos entra no protocolo pré-anestésico nem soma minutos à consulta.
          Eles são o repertório de origem — a prova de que o padrão de widget já existia e foi
          adaptado, não inventado para a demonstração.
        </p>
      </div>
    </div>
  )
}

function CartaoRepertorio({
  def,
  aberto,
  onAlternar,
}: {
  def: DefWidgetDietFlow
  aberto: boolean
  onAlternar: () => void
}) {
  const [dados, setDados] = useState<unknown>(() => def.dadosIniciais())

  const Componente = def.Componente as unknown as ComponentType<{
    dados: unknown
    onChange: (d: unknown) => void
  }>
  const Icone = def.icone

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', aberto && 'ring-1 ring-border')}>
      <button
        type="button"
        onClick={onAlternar}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <Icone className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-sm font-medium">{def.nome}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {def.resumo(dados as never)}
            </span>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
            {def.descricao}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {aberto && (
        <div className="border-t bg-muted/20 px-5 py-4">
          <Componente dados={dados} onChange={setDados} />
        </div>
      )}
    </div>
  )
}

export { Rotulo }
