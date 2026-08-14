/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stats: vi.fn(),
  graphData: vi.fn(),
  metadataStatus: vi.fn(),
  listarChunks: vi.fn(),
  carregarDemonstracao: vi.fn(),
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
    listarChunks: mocks.listarChunks,
    carregarDemonstracao: mocks.carregarDemonstracao,
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
        chunks_count: 3,
      }],
      totais: { total_fontes: 1, total_chunks: 3, total_sistema: 0, total_usuario: 1 },
    })
    mocks.graphData.mockResolvedValue({ nodes: [], links: [] })
    mocks.metadataStatus.mockResolvedValue({
      available: true,
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      message: 'Gemini pronto',
    })
    mocks.listarChunks.mockResolvedValue([{ id: 1, source_id: 7, conteudo: 'Trecho recuperável', importance: 'high', last_accessed_at: null, access_count: 0 }])
    mocks.carregarDemonstracao.mockResolvedValue({ imported: 3, sources_count: 3, source_ids: [1, 2, 3], fixture_version: 'curated-demo-v1' })
  })

  it('expõe biblioteca, chunks, grafo e importação no mesmo studio', async () => {
    const { MemoriaPagina } = await import('../../src/renderer/src/paginas/MemoriaPagina')
    const user = userEvent.setup()
    render(<MemoriaPagina />)

    expect(await screen.findByText('Treinamento pré-anestésico')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Biblioteca/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chunks/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Grafo/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Importar$/i }))
    expect(screen.getByRole('dialog', { name: /Importar documento/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Treinamento pré-anestésico 3 chunks/i }))
    await waitFor(() => expect(mocks.listarChunks).toHaveBeenCalledWith(7))
    expect(await screen.findByText('Trecho recuperável')).toBeInTheDocument()
  })

  it('carrega o corpus de demonstração e abre o grafo', async () => {
    const { MemoriaPagina } = await import('../../src/renderer/src/paginas/MemoriaPagina')
    const user = userEvent.setup()
    render(<MemoriaPagina />)

    await screen.findByText('Treinamento pré-anestésico')
    await user.click(screen.getByRole('button', { name: /Exemplos/i }))
    await waitFor(() => expect(mocks.carregarDemonstracao).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('tab', { name: /Grafo/i })).toHaveAttribute('data-state', 'active')
  })
})
