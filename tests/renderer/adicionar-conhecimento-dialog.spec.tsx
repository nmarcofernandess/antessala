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
    mocks.extrairTexto.mockResolvedValue({
      nome_arquivo: 'protocolo-cientifico.md',
      texto: 'Conteudo longo para importar no RAG com contexto suficiente para passar pela validacao.',
    })
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
        iaRouteMessage="OpenRouter ainda não tem um token configurado."
        iaRouteAction="Revise as Configurações de IA."
      />,
    )

    await user.click(screen.getByText(/Arraste um arquivo/i))

    expect(await screen.findByDisplayValue('protocolo-cientifico.md')).toBeTruthy()
    expect(screen.getByText('Metadados automáticos indisponíveis')).toBeTruthy()
    expect(screen.getByText('OpenRouter ainda não tem um token configurado.')).toBeTruthy()
    expect(screen.getByText('Revise as Configurações de IA.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Gerar título com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Gerar sugestão com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.gerarMetadataIa).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Sobre o quê/i), 'Protocolo científico de avaliação pré-operatória')
    await user.click(screen.getByRole('button', { name: /Salvar documento/i }))

    await waitFor(() => {
      expect(mocks.importarCompleto).toHaveBeenCalledWith(
        'protocolo-cientifico.md',
        'Conteudo longo para importar no RAG com contexto suficiente para passar pela validacao.',
        'Protocolo científico de avaliação pré-operatória',
        true,
      )
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('asks Gemini for both metadata fields and starts enrichment when saving', async () => {
    mocks.escolherArquivo.mockResolvedValue('/tmp/seguranca-cirurgica.md')
    mocks.extrairTexto.mockResolvedValue({
      nome_arquivo: 'seguranca-cirurgica.md',
      texto: 'Documento sobre verificação perioperatória, comunicação da equipe e prevenção de eventos evitáveis.',
    })
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

    await user.click(screen.getByText(/Arraste um arquivo/i))
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
      )
    })
  })
})
