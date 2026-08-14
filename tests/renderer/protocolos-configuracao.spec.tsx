/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Configurações › Protocolos, na sessão sem banco.
 *
 * Fora do Electron a tela precisa continuar inteira — é assim que a vitrine roda
 * no navegador. O que ela não pode fazer é mentir: sem ponte, edição vale para a
 * sessão, e a tela diz isso.
 */
vi.mock('@/servicos/client', () => ({
  temPersistencia: false,
  client: {},
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: ({ actions }: { actions?: React.ReactNode }) => (
    <div data-testid="page-header">{actions}</div>
  ),
}))

describe('Configurações › Protocolos', () => {
  beforeEach(async () => {
    const { resetarStoreDeProtocolos } = await import(
      '../../src/renderer/src/vitrine/protocolos-store'
    )
    resetarStoreDeProtocolos()
  })

  async function abrirTela() {
    const { ProtocolosPagina } = await import('../../src/renderer/src/paginas/ProtocolosPagina')
    render(
      <MemoryRouter>
        <ProtocolosPagina />
      </MemoryRouter>,
    )
    return userEvent.setup()
  }

  /** O botão do cabeçalho — o estado vazio oferece um segundo com o mesmo nome. */
  function botaoNovaCirurgia() {
    return within(screen.getByTestId('page-header')).getByRole('button', {
      name: /Nova cirurgia/,
    })
  }

  it('lista os protocolos de fábrica e declara que a sessão não persiste', async () => {
    await abrirTela()
    expect(screen.getByText('12 protocolos')).toBeInTheDocument()
    expect(screen.getByText(/Sessão sem banco/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Artroplastia de quadril/ })).toBeInTheDocument()
  })

  it('nova cirurgia abre o composer vazio, com estado vazio e sem widget nenhum', async () => {
    const user = await abrirTela()
    await user.click(botaoNovaCirurgia())

    expect(screen.getByLabelText('Cirurgia ou procedimento')).toHaveValue('')
    expect(screen.getByText('A entrevista está vazia')).toBeInTheDocument()
    expect(screen.getByText('0 widgets · 0 procedimentos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar protocolo/ })).toBeDisabled()
  })

  it('o drawer inclui widgets na composição e o salvar destrava', async () => {
    const user = await abrirTela()
    await user.click(botaoNovaCirurgia())
    await user.type(screen.getByLabelText('Cirurgia ou procedimento'), 'Cirurgia nova')
    await user.click(screen.getAllByRole('button', { name: /Adicionar widget/ })[0])

    const painel = screen.getByRole('dialog')
    await user.click(within(painel).getByRole('button', { name: /Alergias/ }))
    await user.click(within(painel).getByRole('button', { name: 'Concluir' }))

    expect(screen.getByText('1 widget · 0 procedimentos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar protocolo/ })).toBeEnabled()
  })

  it('procedimento que já tem dono aparece bloqueado no seletor', async () => {
    const user = await abrirTela()
    await user.click(botaoNovaCirurgia())

    const jaUsado = screen.getByRole('button', { name: 'Facectomia com implante' })
    expect(jaUsado).toBeDisabled()
    expect(jaUsado).toHaveAttribute('title', 'Já usado por "Facectomia"')
  })

  it('o protocolo geral não oferece arquivamento nem troca de nome', async () => {
    const user = await abrirTela()
    await user.click(screen.getByRole('button', { name: /Protocolo geral completo/ }))

    expect(screen.getByLabelText('Cirurgia ou procedimento')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Mais' })).not.toBeInTheDocument()
  })

  it('a tela nunca promete decisão clínica', async () => {
    const user = await abrirTela()
    await user.click(screen.getByRole('button', { name: /Artroplastia de quadril/ }))

    expect(screen.getByText(/nenhuma instituição validou/i)).toBeInTheDocument()
    expect(screen.queryByText(/\bASA\b|aptid|risco alto|conduta sugerida/i)).not.toBeInTheDocument()
  })
})
