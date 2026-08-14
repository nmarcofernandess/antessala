/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  stats: vi.fn(),
  graphData: vi.fn(),
  metadataStatus: vi.fn(),
}))

vi.mock('@/componentes/PageHeader', () => ({ PageHeader: () => <div data-testid="page-header" /> }))
vi.mock('@/componentes/GraphVisualizer', () => ({ GraphVisualizer: () => <div data-testid="graph" /> }))
vi.mock('@/componentes/AdicionarConhecimentoDialog', () => ({
  AdicionarConhecimentoDialog: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Importar documento">Importar documento</div> : null,
}))
vi.mock('@/servicos/conhecimento', () => ({
  servicoConhecimento: {
    stats: mocks.stats,
    graphData: mocks.graphData,
    metadataStatus: mocks.metadataStatus,
    toggleAtivo: vi.fn(),
    removerFonte: vi.fn(),
    enrich: vi.fn(),
  },
}))

describe('Memória — knowledge studio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stats.mockResolvedValue({
      fontes: [{
        id: 7,
        tipo: 'manual',
        titulo: 'Treinamento pré-anestésico',
        importance: 'high',
        ativo: true,
        criada_em: '2026-08-14',
        atualizada_em: '2026-08-14',
        source_format: 'pdf',
        page_count: 12,
        word_count: 4820,
        enrichment_status: 'ready',
      }],
      totais: { total_documentos: 1, total_conceitos: 8, total_relacoes: 6 },
    })
    mocks.graphData.mockResolvedValue({ nodes: [], links: [] })
    mocks.metadataStatus.mockResolvedValue({
      available: true,
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      message: 'Gemini pronto',
    })
  })

  it('expõe somente biblioteca e grafo, sem linguagem de chunks', async () => {
    const { MemoriaPagina } = await import('../../src/renderer/src/paginas/MemoriaPagina')
    const user = userEvent.setup()
    render(<MemoryRouter><MemoriaPagina /></MemoryRouter>)

    expect(await screen.findByText('Treinamento pré-anestésico')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Biblioteca/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Grafo/i })).toBeInTheDocument()
    expect(screen.queryByText(/chunks/i)).not.toBeInTheDocument()
    expect(screen.getByText('Documentos')).toBeInTheDocument()
    expect(screen.getAllByText('Conceitos').length).toBeGreaterThan(0)
    expect(screen.getByText('Relações')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Importar$/i }))
    expect(screen.getByRole('dialog', { name: /Importar documento/i })).toBeInTheDocument()

    expect(screen.getByText(/PDF · 12 páginas/i)).toBeInTheDocument()
  })

  it('não expõe uma ação teatral para carregar o corpus inicial', async () => {
    const { MemoriaPagina } = await import('../../src/renderer/src/paginas/MemoriaPagina')
    render(<MemoryRouter><MemoriaPagina /></MemoryRouter>)

    await screen.findByText('Treinamento pré-anestésico')
    expect(screen.queryByRole('button', { name: /Exemplos/i })).not.toBeInTheDocument()
  })
})
