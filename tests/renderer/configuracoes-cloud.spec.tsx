/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  obter: vi.fn(),
  salvar: vi.fn(),
  testar: vi.fn(),
}))

vi.mock('@/servicos/client', () => ({
  client: {
    'ia.configuracao.obter': mocks.obter,
    'ia.configuracao.salvar': mocks.salvar,
    'ia.configuracao.testar': mocks.testar,
  },
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header" />,
}))

describe('Configurações do assistente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.obter.mockResolvedValue({
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
      api_key: '',
      configurado: true,
      provider_configs_json: '{}',
    })
    mocks.salvar.mockResolvedValue({
      provider: 'gemini',
      modelo: 'gemini-3.5-flash',
      api_key: '',
      configurado: true,
      provider_configs_json: '{}',
    })
  })

  it('mostra somente provider cloud, token, modelo, salvar e testar', async () => {
    const { ConfiguracoesPagina } = await import('../../src/renderer/src/paginas/ConfiguracoesPagina')
    render(<ConfiguracoesPagina />)

    await waitFor(() => expect(screen.getByLabelText('Token da API')).toHaveAttribute(
      'placeholder',
      'Chave salva — deixe vazio para manter',
    ))

    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
    expect(screen.getByLabelText('Modelo')).toHaveValue('gemini-3.5-flash')
    expect(screen.getByRole('button', { name: /Testar conexão/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar/i })).toBeInTheDocument()
    expect(screen.queryByText(/IA local|roteamento|backup|cron|terminal|memória automática/i)).not.toBeInTheDocument()
  })

  it('salva pelo client tipado sem colocar o token no JSON de compatibilidade', async () => {
    const { ConfiguracoesPagina } = await import('../../src/renderer/src/paginas/ConfiguracoesPagina')
    const user = userEvent.setup()
    render(<ConfiguracoesPagina />)

    const token = await screen.findByLabelText('Token da API')
    await user.type(token, 'segredo-novo')
    await user.click(screen.getByRole('button', { name: /^Salvar$/i }))

    await waitFor(() => expect(mocks.salvar).toHaveBeenCalledWith({
      provider: 'gemini',
      api_key: 'segredo-novo',
      modelo: 'gemini-3.5-flash',
      provider_configs_json: JSON.stringify({ gemini: { modelo: 'gemini-3.5-flash' } }),
    }))
    expect(mocks.salvar.mock.calls[0][0].provider_configs_json).not.toContain('segredo-novo')
  })
})
