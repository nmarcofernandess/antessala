/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider } from '../../src/renderer/src/components/ui/sidebar'
import { Dashboard } from '../../src/renderer/src/paginas/Dashboard'

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: ({ breadcrumbs }: { breadcrumbs: Array<{ label: string }> }) => (
    <header>{breadcrumbs.map(({ label }) => label).join(' / ')}</header>
  ),
}))

function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

/**
 * O painel do dia deixou de ser um esqueleto vazio e passou a contar os casos e
 * as vagas da vitrine. As proibições que o esqueleto protegia continuam valendo
 * e são o coração deste teste: contar não é inventar. O painel não fala por
 * outro subsistema, não pergunta configuração de IA nem de backup, e declara na
 * cara que os dados são sintéticos.
 */
describe('Painel do dia — conta o que existe, não inventa', () => {
  beforeEach(() => {
    stubMatchMedia()
  })

  function montar() {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'app:version') return '1.0.0'
      return undefined
    })
    Object.assign(window, {
      electron: { ipcRenderer: { invoke, on: vi.fn(() => vi.fn()) } },
    })

    render(
      <MemoryRouter>
        <SidebarProvider>
          <Dashboard />
        </SidebarProvider>
      </MemoryRouter>,
    )

    return invoke
  }

  it('mostra o painel operacional do dia e assume que o dado é sintético', () => {
    montar()

    expect(screen.getByText('Painel do dia')).toBeInTheDocument()
    expect(screen.getByText('Fluxo do dia')).toBeInTheDocument()

    // Sem este carimbo o painel passaria por dado real de hospital.
    expect(screen.getByText('Dados sintéticos')).toBeInTheDocument()
  })

  it('não inventa status de sistema, memória, embedding nem fonte de conhecimento', () => {
    montar()

    expect(screen.queryByText('Status do sistema')).not.toBeInTheDocument()
    expect(screen.queryByText('Embedding')).not.toBeInTheDocument()
    expect(screen.queryByText('Fontes')).not.toBeInTheDocument()
    expect(screen.queryByText(/Importe documentos/)).not.toBeInTheDocument()
  })

  it('não expõe motivo clínico na fila da recepção', () => {
    montar()

    // A fila mostra classe, duração e recurso — nunca o achado que os produziu.
    // O escopo é a fila, e não a página: explicar a regra de dimensionamento em
    // outro bloco é legítimo; carimbar o achado ao lado do nome de alguém não é.
    const fila = within(screen.getByTestId('fila-do-dia'))

    // Termos inequívocos de achado: o nome do procedimento pode conter
    // "diagnóstica" sem ser um diagnóstico, e isso é dado do encaminhamento.
    for (const clinico of [
      /alergia/i,
      /anticoagulante/i,
      /comorbidade/i,
      /hipertens/i,
      /diabet/i,
      /\bCID\b/,
    ]) {
      expect(fila.queryByText(clinico)).not.toBeInTheDocument()
    }
  })

  it('não consulta configuração de IA nem de backup ao abrir', async () => {
    const invoke = montar()

    await waitFor(() => {
      const channels = invoke.mock.calls.map(([channel]) => channel)
      expect(channels).not.toContain('ia.configuracao.obter')
      expect(channels).not.toContain('backup.config.obter')
    })
  })
})
