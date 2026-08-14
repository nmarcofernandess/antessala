/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A aba vem da rota, não de estado interno — é o que faz link direto e botão
 * voltar continuarem valendo depois que a tela ganhou duas metades.
 */
vi.mock('@/servicos/client', () => ({
  temPersistencia: false,
  client: {},
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: ({ breadcrumbs }: { breadcrumbs: { label: string }[] }) => (
    <div data-testid="page-header">{breadcrumbs.map((b) => b.label).join(' › ')}</div>
  ),
}))

describe('Repertório — abas', () => {
  beforeEach(async () => {
    const { resetarStoreDeProtocolos } = await import(
      '../../src/renderer/src/vitrine/protocolos-store'
    )
    resetarStoreDeProtocolos()
  })

  async function abrir(rota: string) {
    const { RepertorioPagina } = await import('../../src/renderer/src/paginas/RepertorioPagina')
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/repertorio" element={<RepertorioPagina />} />
          <Route path="/repertorio/widgets" element={<RepertorioPagina />} />
        </Routes>
      </MemoryRouter>,
    )
    return userEvent.setup()
  }

  it('/repertorio abre em Protocolos', async () => {
    await abrir('/repertorio')

    expect(screen.getByRole('tab', { name: 'Protocolos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('12 protocolos')).toBeInTheDocument()
    expect(screen.getByTestId('page-header')).toHaveTextContent('Antessala › Repertório › Protocolos')
  })

  it('/repertorio/widgets abre direto no catálogo', async () => {
    await abrir('/repertorio/widgets')

    expect(screen.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Widgets do Antessala' })).toBeInTheDocument()
    expect(screen.queryByText('12 protocolos')).not.toBeInTheDocument()
  })

  it('clicar na aba navega e troca o painel', async () => {
    const user = await abrir('/repertorio')

    await user.click(screen.getByRole('tab', { name: 'Widgets' }))

    expect(screen.getByRole('heading', { name: 'Herança do DietFlow' })).toBeInTheDocument()
    expect(screen.queryByText('12 protocolos')).not.toBeInTheDocument()
  })
})
