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
    mocks.escolherArquivo.mockResolvedValue('/tmp/plano-flowkit.md')
    mocks.extrairTexto.mockResolvedValue({
      nome_arquivo: 'plano-flowkit.md',
      texto: 'Conteudo longo para importar no RAG com contexto suficiente para passar pela validacao.',
    })
    mocks.importarCompleto.mockResolvedValue({
      source_id: 7,
      chunks_count: 2,
      entities_count: 0,
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

    expect(await screen.findByDisplayValue('plano-flowkit.md')).toBeTruthy()
    expect(screen.getByText('Metadados automáticos indisponíveis')).toBeTruthy()
    expect(screen.getByText('OpenRouter ainda não tem um token configurado.')).toBeTruthy()
    expect(screen.getByText('Revise as Configurações de IA.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Gerar título com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Gerar sugestão com IA/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.gerarMetadataIa).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Sobre o quê/i), 'Documentacao operacional do FlowKit')
    await user.click(screen.getByRole('button', { name: /^Salvar$/i }))

    await waitFor(() => {
      expect(mocks.importarCompleto).toHaveBeenCalledWith(
        'plano-flowkit.md',
        'Conteudo longo para importar no RAG com contexto suficiente para passar pela validacao.',
        'Documentacao operacional do FlowKit',
      )
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
