/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider } from '../../src/renderer/src/components/ui/sidebar'
import { AppSidebar } from '../../src/renderer/src/componentes/AppSidebar'

const themeMock = vi.hoisted(() => ({
  theme: 'system',
  setTheme: vi.fn(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => themeMock,
}))

function stubElectron() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'app:version') return '1.0.0'
    return undefined
  })
  Object.assign(window, {
    electron: { ipcRenderer: { invoke, on: vi.fn(() => vi.fn()) } },
  })
}

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

function renderSidebar(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  )
}

/** O menu da conta só existe montado; Radix não renderiza conteúdo fechado. */
async function abrirMenuDaConta() {
  await userEvent.click(screen.getByRole('button', { name: 'Menu da conta' }))
  return screen.getByRole('menu')
}

describe('AppSidebar — casca ativa do Antessala', () => {
  beforeEach(() => {
    themeMock.theme = 'system'
    themeMock.setTheme.mockReset()
    stubElectron()
    stubMatchMedia()
  })

  it('a navegação carrega o fluxo do caso e nada além dele', async () => {
    renderSidebar()

    await screen.findByText('v1.0.0')

    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda')
    expect(screen.getByRole('link', { name: 'Repertório' })).toHaveAttribute('href', '/repertorio')
    expect(screen.getByRole('link', { name: 'Assistente' })).toHaveAttribute('href', '/assistente')
    expect(screen.getByRole('link', { name: 'Memória' })).toHaveAttribute('href', '/memoria')

    // "Triagem" saiu com a tela de vitrine: a entrevista real abre pelo caso.
    for (const removedOrHidden of [
      'Galeria',
      'Terminal',
      'Maia',
      'Setup',
      'Como funciona',
      'Triagem',
    ]) {
      expect(screen.queryByText(removedOrHidden, { exact: true })).not.toBeInTheDocument()
    }
  })

  it('Configurações não ocupa linha da navegação: é ajuste de operador, não etapa', () => {
    renderSidebar()

    expect(screen.queryByRole('link', { name: 'Configurações' })).not.toBeInTheDocument()
  })

  it('o menu da conta leva às configurações e declara que a conta é sintética', async () => {
    renderSidebar()

    expect(screen.getAllByText('Conta da demonstração').length).toBeGreaterThan(0)
    expect(screen.getByText('Demonstração integrada')).toBeInTheDocument()

    const menu = await abrirMenuDaConta()
    expect(within(menu).getByRole('menuitem', { name: 'Configurações' })).toHaveAttribute(
      'href',
      '/configuracoes',
    )
  })

  it('mantém claro, escuro e sistema acessíveis dentro do menu da conta', async () => {
    renderSidebar()

    const menu = await abrirMenuDaConta()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tema' }))

    const claro = await screen.findByRole('menuitemradio', { name: 'Claro' })
    const escuro = screen.getByRole('menuitemradio', { name: 'Escuro' })
    const sistema = screen.getByRole('menuitemradio', { name: 'Sistema' })

    expect(sistema).toHaveAttribute('aria-checked', 'true')
    expect(claro).toHaveAttribute('aria-checked', 'false')
    expect(escuro).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(claro)
    expect(themeMock.setTheme).toHaveBeenCalledWith('light')
  })

  it('o menu não promete conta, papel ou sessão que o produto não tem', async () => {
    renderSidebar()

    const menu = await abrirMenuDaConta()
    for (const promessaFalsa of ['Sair', 'Perfil', 'Trocar de papel', 'Criar usuário']) {
      expect(within(menu).queryByText(promessaFalsa)).not.toBeInTheDocument()
    }
  })
})
