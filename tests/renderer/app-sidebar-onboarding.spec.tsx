/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider } from '../../src/renderer/src/components/ui/sidebar'
import { AppSidebar } from '../../src/renderer/src/componentes/AppSidebar'
import {
  OnboardingTourProvider,
  type TourStep,
} from '../../src/renderer/src/componentes/onboarding/OnboardingTour'
import { TOUR_STEP_IDS } from '../../src/renderer/src/componentes/onboarding/tour-steps'

// O tour aponta o id do footer (FOOTER_MENU), que a própria AppSidebar planta.
// Passo único é suficiente para provar que "Como funciona" inicia o tour.
const steps: TourStep[] = [
  {
    targetId: TOUR_STEP_IDS.FOOTER_MENU,
    position: 'right',
    content: <h3>Menu da conta</h3>,
  },
]

function stubElectron() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'app:version') return '1.0.0'
    return undefined
  })
  const on = vi.fn(() => vi.fn())
  Object.assign(window, { electron: { ipcRenderer: { invoke, on } } })
}

// SidebarProvider usa o hook use-mobile, que chama window.matchMedia — ausente
// no jsdom. Polyfill mínimo (sempre desktop) para a sidebar montar.
function stubMatchMedia() {
  if (typeof window.matchMedia === 'function') return
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

function renderSidebar(onReopenSetup = vi.fn()) {
  render(
    <MemoryRouter>
      <OnboardingTourProvider steps={steps}>
        <SidebarProvider>
          <AppSidebar onReopenSetup={onReopenSetup} />
        </SidebarProvider>
      </OnboardingTourProvider>
    </MemoryRouter>,
  )
}

async function openAccountMenu() {
  // O trigger do menu da conta é o botão do footer (mostra APP_NAME + chevron).
  // Há mais de um elemento com APP_NAME; o trigger é o que tem aria-haspopup.
  const triggers = screen.getAllByRole('button')
  const trigger = triggers.find((b) => b.getAttribute('aria-haspopup') === 'menu')
  if (!trigger) throw new Error('account menu trigger not found')
  await userEvent.click(trigger)
}

describe('AppSidebar — replay de onboarding (2 itens no menu da conta)', () => {
  beforeEach(() => {
    stubElectron()
    stubMatchMedia()
  })

  it('o menu da conta tem "Setup" e "Como funciona" como itens separados', async () => {
    renderSidebar()
    await openAccountMenu()

    expect(await screen.findByRole('menuitem', { name: 'Setup' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Como funciona' })).toBeInTheDocument()
  })

  it('clicar "Setup" chama onReopenSetup (reabre o modal)', async () => {
    const onReopenSetup = vi.fn()
    renderSidebar(onReopenSetup)
    await openAccountMenu()

    await userEvent.click(await screen.findByRole('menuitem', { name: 'Setup' }))
    expect(onReopenSetup).toHaveBeenCalledTimes(1)
  })

  it('clicar "Como funciona" inicia o tour (card do 1º passo aparece)', async () => {
    renderSidebar()
    await openAccountMenu()

    expect(screen.queryByText('Menu da conta')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Como funciona' }))

    // O card do tour renderiza com o conteúdo do 1º passo + contagem "1 de 1".
    expect(await screen.findByText('Menu da conta')).toBeInTheDocument()
    expect(screen.getByText('1 de 1')).toBeInTheDocument()
  })

  it('"Como funciona" aparece mesmo sem onReopenSetup, mas "Setup" não', async () => {
    render(
      <MemoryRouter>
        <OnboardingTourProvider steps={steps}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </OnboardingTourProvider>
      </MemoryRouter>,
    )
    await openAccountMenu()

    expect(await screen.findByRole('menuitem', { name: 'Como funciona' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Setup' })).not.toBeInTheDocument()
  })
})
