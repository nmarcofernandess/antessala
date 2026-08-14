/**
 * Repertório — o repositório da entrevista.
 *
 * Duas abas porque são duas perguntas do mesmo assunto: **Protocolos** diz o que
 * cada cirurgia pergunta, **Widgets** diz o que existe para ser perguntado. Antes
 * as duas moravam longe uma da outra — o cadastro escondido em Configurações e o
 * catálogo aqui, exibindo widget alheio sem dizer para que servia.
 *
 * A aba vem da rota, não de estado interno: link direto, botão voltar e
 * breadcrumb continuam funcionando.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/componentes/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PainelProtocolos } from './repertorio/PainelProtocolos'
import { PainelWidgets } from './repertorio/PainelWidgets'

const ABAS = [
  { valor: 'protocolos', rotulo: 'Protocolos', rota: '/repertorio' },
  { valor: 'widgets', rotulo: 'Widgets', rota: '/repertorio/widgets' },
] as const

type Aba = (typeof ABAS)[number]['valor']

export function RepertorioPagina() {
  const { pathname } = useLocation()
  const navegar = useNavigate()

  const aba: Aba = pathname.startsWith('/repertorio/widgets') ? 'widgets' : 'protocolos'
  const rotulo = ABAS.find((a) => a.valor === aba)!.rotulo

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: 'Antessala' },
          { label: 'Repertório', href: '/repertorio' },
          { label: rotulo },
        ]}
      />

      <div className="border-b px-4 py-2">
        <Tabs
          value={aba}
          onValueChange={(valor) => {
            const destino = ABAS.find((a) => a.valor === valor)
            if (destino) navegar(destino.rota)
          }}
        >
          <TabsList>
            {ABAS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                {a.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {aba === 'protocolos' ? <PainelProtocolos /> : <PainelWidgets />}
    </div>
  )
}
