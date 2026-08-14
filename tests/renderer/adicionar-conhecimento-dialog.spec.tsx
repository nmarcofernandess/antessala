/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  escolherArquivo: vi.fn(),
  extrairTexto: vi.fn(),
  gerarMetadataIa: vi.fn(),
  importarCompleto: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/servicos/conhecimento', () => ({
  servicoConhecimento: {
    escolherArquivo: mocks.escolherArquivo,
    extrairTexto: mocks.extrairTexto,
    gerarMetadataIa: mocks.gerarMetadataIa,
    importarCompleto: mocks.importarCompleto,
    escolherPasta: vi.fn(),
    iniciarBulkImport: vi.fn(),
    obterJob: vi.fn(),
    pausarJob: vi.fn(),
    retomarJob: vi.fn(),
    cancelarJob: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

describe('AdicionarConhecimentoDialog AI metadata readiness', () => {
  const structured = (fileName: string, text: string) => ({
    format: 'markdown' as const,
    tiptapJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    markdown: text,
    text,
    suggestedTitle: fileName.replace(/\.md$/, ''),
    pages: [{ number: 1, text, wordCount: text.split(/\s+/).length }],
    wordCount: text.split(/\s+/).length,
    warnings: [],
    metadata: {
      fileName,
      extension: '.md',
      mimeType: 'text/markdown',
      byteSize: text.length,
      modifiedAt: '2026-08-14T00:00:00.000Z',
      pageCount: 1,
      sourcePath: `/tmp/${fileName}`,
    },
  })

  beforeEach(() => {
    mocks.escolherArquivo.mockReset()
    mocks.extrairTexto.mockReset()
    mocks.gerarMetadataIa.mockReset()
    mocks.importarCompleto.mockReset()
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
  })

  it('explains unavailable cloud metadata, keeps filename fallback, and still saves manually', async () => {
    mocks.escolherArquivo.mockResolvedValue('/tmp/protocolo-cientifico.md')
    const text = 'Conteudo longo para importar no RAG com contexto suficiente para passar pela validacao.'
    const document = structured('protocolo-cientifico.md', text)
    mocks.extrairTexto.mockResolvedValue({ document, sha256: 'abc123' })
    mocks.importarCompleto.mockResolvedValue({
      source_id: 7,
      chunks_count: 2,
      entities_count: 0,
      enrichment: { status: 'skipped' },
    })
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    const { AdicionarConhecimentoDialog } = await import('../../src/renderer/src/componentes/AdicionarConhecimentoDialog')

    render(
      <AdicionarConhecimentoDialog
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        iaDisponivel={false}
        iaRouteMessage="Gemini ainda não tem uma chave configurada."
        iaRouteAction="Revise as Configurações de IA."
      />,
    )

    await user.click(screen.getByText(/Arraste um PDF/i))

    expect(await screen.findByDisplayValue('protocolo-cientifico')).toBeTruthy()
    expect(screen.getByText('Metadados automáticos indisponíveis')).toBeTruthy()
    expect(screen.getByText('Gemini ainda não tem uma chave configurada.')).toBeTruthy()
    expect(screen.getByText('Revise as Configurações de IA.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Gerar título com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Gerar sugestão com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.gerarMetadataIa).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Salvar documento/i }))

    await waitFor(() => {
      expect(mocks.importarCompleto).toHaveBeenCalledWith(
        'protocolo-cientifico',
        text,
        '',
        true,
        document,
        'abc123',
      )
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('asks Gemini for both metadata fields and starts enrichment when saving', async () => {
    mocks.escolherArquivo.mockResolvedValue('/tmp/seguranca-cirurgica.md')
    const text = 'Documento sobre verificação perioperatória, comunicação da equipe e prevenção de eventos evitáveis.'
    const document = structured('seguranca-cirurgica.md', text)
    mocks.extrairTexto.mockResolvedValue({ document, sha256: 'def456' })
    mocks.gerarMetadataIa
      .mockResolvedValueOnce({ resultado: 'Segurança perioperatória' })
      .mockResolvedValueOnce({ resultado: 'Checklist, comunicação e prevenção de eventos perioperatórios' })
    mocks.importarCompleto.mockResolvedValue({
      source_id: 8,
      chunks_count: 1,
      entities_count: 3,
      enrichment: { status: 'completed', chunks_enriquecidos: 1, entities_count: 3, relations_count: 2 },
    })

    const user = userEvent.setup()
    const { AdicionarConhecimentoDialog } = await import('../../src/renderer/src/componentes/AdicionarConhecimentoDialog')
    render(
      <AdicionarConhecimentoDialog
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        iaDisponivel
      />,
    )

    await user.click(screen.getByText(/Arraste um PDF/i))
    expect(await screen.findByDisplayValue('Segurança perioperatória')).toBeTruthy()
    expect(mocks.gerarMetadataIa).toHaveBeenNthCalledWith(1, expect.any(String), 'titulo')
    expect(mocks.gerarMetadataIa).toHaveBeenNthCalledWith(2, expect.any(String), 'quando_consultar')

    await user.click(screen.getByRole('button', { name: /Salvar e enriquecer/i }))
    await waitFor(() => {
      expect(mocks.importarCompleto).toHaveBeenCalledWith(
        'Segurança perioperatória',
        expect.any(String),
        'Checklist, comunicação e prevenção de eventos perioperatórios',
        true,
        document,
        'def456',
      )
    })
  })
})
