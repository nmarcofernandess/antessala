/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  OnboardingTourProvider,
  useOnboardingTour,
  type TourStep,
} from '../../src/renderer/src/componentes/onboarding/OnboardingTour'

// Passos com targets reais (montados abaixo) e SEM onEnter — espelha a escolha
// de produção (todo alvo é elemento sempre montado, sem navegação/flake).
const steps: TourStep[] = [
  {
    targetId: 'alvo-1',
    position: 'right',
    content: <h3>Passo Memória</h3>,
  },
  {
    targetId: 'alvo-2',
    position: 'bottom',
    content: <h3>Passo Galeria</h3>,
  },
  {
    targetId: 'alvo-3',
    position: 'left',
    content: <h3>Passo Final</h3>,
  },
]

/** Harness: monta os elementos-alvo + um botão que chama startTour(). */
function Harness({ tourSteps = steps }: { tourSteps?: TourStep[] }) {
  return (
    <OnboardingTourProvider steps={tourSteps}>
      <div id="alvo-1">um</div>
      <div id="alvo-2">dois</div>
      <div id="alvo-3">tres</div>
      <StartButton />
    </OnboardingTourProvider>
  )
}

function StartButton() {
  const { startTour } = useOnboardingTour()
  return (
    <button type="button" onClick={() => startTour()}>
      iniciar
    </button>
  )
}

async function startTour() {
  await userEvent.click(screen.getByRole('button', { name: 'iniciar' }))
}

describe('OnboardingTour — engine spotlight genérica', () => {
  it('não renderiza nenhum card antes de startTour (on-demand, não auto-abre)', () => {
    render(<Harness />)
    expect(screen.queryByText('Passo Memória')).not.toBeInTheDocument()
    expect(screen.queryByText(/de \d/)).not.toBeInTheDocument()
  })

  it('startTour mostra o 1º passo com conteúdo e contagem "1 de 3"', async () => {
    render(<Harness />)
    await startTour()

    expect(await screen.findByText('Passo Memória')).toBeInTheDocument()
    expect(screen.getByText('1 de 3')).toBeInTheDocument()
    // No 1º passo não há "Anterior".
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()
  })

  it('Próximo avança e Anterior volta entre passos', async () => {
    render(<Harness />)
    await startTour()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Passo Galeria')).toBeInTheDocument()
    expect(screen.getByText('2 de 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByText('Passo Memória')).toBeInTheDocument()
    expect(screen.getByText('1 de 3')).toBeInTheDocument()
  })

  it('no último passo o botão vira "Concluir" e encerra o tour', async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingTourProvider steps={steps} onComplete={onComplete}>
        <div id="alvo-1">um</div>
        <div id="alvo-2">dois</div>
        <div id="alvo-3">tres</div>
        <StartButton />
      </OnboardingTourProvider>,
    )
    await startTour()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Passo Final')).toBeInTheDocument()
    expect(screen.getByText('3 de 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.queryByText('Passo Final')).not.toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('Pular encerra o tour em qualquer passo', async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingTourProvider steps={steps} onComplete={onComplete}>
        <div id="alvo-1">um</div>
        <div id="alvo-2">dois</div>
        <div id="alvo-3">tres</div>
        <StartButton />
      </OnboardingTourProvider>,
    )
    await startTour()

    expect(await screen.findByText('Passo Memória')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(screen.queryByText('Passo Memória')).not.toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('useOnboardingTour fora do provider lança erro claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<StartButton />)).toThrow(
      /useOnboardingTour must be used within OnboardingTourProvider/,
    )
    spy.mockRestore()
  })
})
