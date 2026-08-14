/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider } from '../../src/renderer/src/components/ui/sidebar'
import { AppSidebar } from '../../src/renderer/src/componentes/AppSidebar'
import { AuthProvider } from '../../src/renderer/src/mvp/AuthProvider'

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
    if (channel === 'auth.current') {
      return {
        userId: 'admin-fixture',
        email: 'admin@antessala.demo',
        name: 'Admin Demo',
        role: 'ADMIN',
        requesterService: null,
      }
    }
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
      <AuthProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppSidebar — casca ativa do Antessala', () => {
  beforeEach(() => {
    themeMock.theme = 'system'
    themeMock.setTheme.mockReset()
    stubElectron()
    stubMatchMedia()
  })

  it('expõe somente rotas ativas e não aponta para superfícies escondidas ou removidas', async () => {
    renderSidebar()

    await screen.findByText('v1.0.0')

    expect(screen.getByRole('link', { name: 'Operação' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute(
      'href',
      '/configuracoes',
    )
    expect(screen.queryByRole('link', { name: 'Assistente IA' })).not.toBeInTheDocument()

    for (const removedOrHidden of [
      'Memória',
      'Galeria',
      'Terminal',
      'Maia',
      'Setup',
      'Como funciona',
    ]) {
      expect(screen.queryByText(removedOrHidden, { exact: true })).not.toBeInTheDocument()
    }
  })

  it('mantém claro, escuro e sistema acessíveis no canto da casca', async () => {
    renderSidebar()

    const selector = screen.getByRole('radiogroup', { name: 'Tema da interface' })
    const light = screen.getByRole('radio', { name: 'Tema claro' })
    const dark = screen.getByRole('radio', { name: 'Tema escuro' })
    const system = screen.getByRole('radio', { name: 'Tema sistema' })

    expect(selector).toContainElement(light)
    expect(selector).toContainElement(dark)
    expect(selector).toContainElement(system)
    expect(system).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(light)
    await userEvent.click(dark)
    await userEvent.click(system)

    expect(themeMock.setTheme.mock.calls).toEqual([
      ['light'],
      ['dark'],
      ['system'],
    ])
  })
})
