/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  obterDocumento: vi.fn(),
  salvarDocumento: vi.fn(),
  listarVersoes: vi.fn(),
  restaurarVersao: vi.fn(),
  exportarMarkdown: vi.fn(),
  enrich: vi.fn(),
}))

vi.mock('@/componentes/PageHeader', () => ({ PageHeader: () => <div data-testid="page-header" /> }))
vi.mock('@/componentes/RichTextEditor', () => ({
  RichTextEditor: ({ onChange, onTitleChange, status, revision }: any) => (
    <div>
      <span role="status">{status}:{revision}</span>
      <button onClick={() => onTitleChange('Título editado')}>Editar título</button>
      <button onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo editado' }] }] })}>Editar conteúdo</button>
    </div>
  ),
}))
vi.mock('@/servicos/conhecimento', () => ({
  servicoConhecimento: mocks,
}))

const initial = {
  id: 7,
  titulo: 'Documento inicial',
  content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inicial' }] }] },
  content_markdown: 'Inicial',
  plain_text: 'Inicial',
  source_format: 'pdf',
  revision: 1,
  page_count: 12,
  word_count: 4820,
  enrichment_status: 'ready',
  atualizada_em: '2026-08-14T12:00:00.000Z',
  metadata: {},
}

describe('DocumentoMemoriaPagina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.obterDocumento.mockResolvedValue(initial)
    mocks.salvarDocumento.mockImplementation(async (input: any) => ({
      ...initial,
      titulo: input.titulo,
      content_json: input.content_json,
      revision: 2,
    }))
    mocks.listarVersoes.mockResolvedValue([])
    mocks.enrich.mockResolvedValue({ entities_count: 0, relations_count: 0 })
  })

  it('abre em rota própria e faz autosave em 700ms com revisão otimista', async () => {
    const { DocumentoMemoriaPagina } = await import('../../src/renderer/src/paginas/DocumentoMemoriaPagina')
    render(
      <MemoryRouter initialEntries={['/memoria/documentos/7']}>
        <Routes><Route path="/memoria/documentos/:id" element={<DocumentoMemoriaPagina />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('4.820 palavras')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar título' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))

    await waitFor(() => expect(mocks.salvarDocumento).toHaveBeenCalledWith({
      id: 7,
      expected_revision: 1,
      titulo: 'Título editado',
      content_json: expect.objectContaining({ type: 'doc' }),
    }), { timeout: 1_500 })
    expect(await screen.findByRole('status')).toHaveTextContent('saved:2')
  })

  it('abre o histórico sem substituir conteúdo silenciosamente', async () => {
    mocks.listarVersoes.mockResolvedValue([{ ...initial, reason: 'import', criada_em: initial.atualizada_em }])
    const user = userEvent.setup()
    const { DocumentoMemoriaPagina } = await import('../../src/renderer/src/paginas/DocumentoMemoriaPagina')
    render(
      <MemoryRouter initialEntries={['/memoria/documentos/7']}>
        <Routes><Route path="/memoria/documentos/:id" element={<DocumentoMemoriaPagina />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByText('4.820 palavras')
    await user.click(screen.getByRole('button', { name: /Versões/i }))
    expect(await screen.findByText(/Revisão 1 · Documento inicial/)).toBeInTheDocument()
    expect(screen.getByText(/nada é sobrescrito silenciosamente/i)).toBeInTheDocument()
  })

  it('salva e agenda o enriquecimento ao sair antes do debounce', async () => {
    mocks.salvarDocumento.mockImplementation(async (input: any) => ({
      ...initial,
      titulo: input.titulo,
      content_json: input.content_json,
      revision: 2,
      enrichment_status: 'pending',
    }))
    const { DocumentoMemoriaPagina } = await import('../../src/renderer/src/paginas/DocumentoMemoriaPagina')
    const view = render(
      <MemoryRouter initialEntries={['/memoria/documentos/7']}>
        <Routes><Route path="/memoria/documentos/:id" element={<DocumentoMemoriaPagina />} /></Routes>
      </MemoryRouter>,
    )

    await screen.findByText('4.820 palavras')
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    view.unmount()

    await waitFor(() => expect(mocks.salvarDocumento).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.enrich).toHaveBeenCalledWith(7))
  })
})
