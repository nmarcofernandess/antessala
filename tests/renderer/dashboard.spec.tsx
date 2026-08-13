/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
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

describe('Dashboard — esqueleto neutro', () => {
  beforeEach(() => {
    stubMatchMedia()
  })

  it('não inventa status, dados de memória nem regras da fila', async () => {
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

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
    expect(screen.getByText('Estrutura inicial')).toBeInTheDocument()
    expect(
      screen.getByText(/Nenhuma escolha de widget ou regra de ordenação da fila/),
    ).toBeInTheDocument()

    expect(screen.queryByText('Status do sistema')).not.toBeInTheDocument()
    expect(screen.queryByText('Embedding')).not.toBeInTheDocument()
    expect(screen.queryByText('Fontes')).not.toBeInTheDocument()
    expect(screen.queryByText(/Importe documentos/)).not.toBeInTheDocument()

    await waitFor(() => {
      const channels = invoke.mock.calls.map(([channel]) => channel)
      expect(channels).not.toContain('ia.configuracao.obter')
      expect(channels).not.toContain('backup.config.obter')
    })
  })
})
