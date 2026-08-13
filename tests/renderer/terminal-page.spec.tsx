/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTerminalReadiness } from '../../src/shared'

const mocks = vi.hoisted(() => ({
  statusIa: vi.fn(),
  abrirIaNoTerminal: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/servicos/terminal', () => ({
  servicoTerminal: {
    statusIa: mocks.statusIa,
    abrirIaNoTerminal: mocks.abrirIaNoTerminal,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header" />,
}))

function readiness(overrides: Partial<AiTerminalReadiness> = {}): AiTerminalReadiness {
  return {
    ok: true,
    code: 'ready',
    label: 'IA pronta',
    message: 'IA pronta para abrir no Terminal.',
    action: 'launchTerminal',
    blocksLaunch: false,
    command: 'npm run cli -- chat --attach',
    cwd: '/tmp/Flow Kit',
    runtime: {
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      displayName: 'gemini / gemini-3.5-flash',
      toolsAvailable: true,
      toolsCount: 1,
      validatedAt: '2026-06-14T00:00:00.000Z',
      validationTtlMs: 300_000,
    },
    ...overrides,
  }
}

async function renderPage() {
  const { TerminalPagina } = await import('../../src/renderer/src/paginas/TerminalPagina')
  let view: ReturnType<typeof render> | null = null
  await act(async () => {
    view = render(
      <MemoryRouter>
        <TerminalPagina />
      </MemoryRouter>,
    )
  })
  return view!
}

describe('TerminalPagina AI launcher', () => {
  beforeEach(() => {
    mocks.statusIa.mockReset()
    mocks.abrirIaNoTerminal.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    })
  })

  it('renders launcher-only UI without command/message inputs', async () => {
    mocks.statusIa.mockResolvedValue(readiness())
    const view = await renderPage()

    await screen.findByRole('button', { name: /Abrir IA no Terminal do Sistema/i })

    expect(view.container.querySelectorAll('input, textarea')).toHaveLength(0)
    expect(screen.getByText('npm run cli -- chat --attach')).toBeTruthy()
    expect(screen.getByText('gemini / gemini-3.5-flash')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copiar comando/i })).toBeTruthy()
  })

  it('keeps blocked readiness in-app and opens the configuration dialog instead of succeeding', async () => {
    const blocked = readiness({
      ok: false,
      code: 'credentialMissing',
      label: 'IA precisa de credencial',
      message: 'Informe a API key/token do provider ativo.',
      action: 'openConfig',
      blocksLaunch: true,
    })
    mocks.statusIa.mockResolvedValue(blocked)
    mocks.abrirIaNoTerminal.mockResolvedValue({
      opened: false,
      status: 'blocked',
      command: blocked.command,
      cwd: blocked.cwd,
      readiness: blocked,
      error_message: blocked.message,
    })
    const user = userEvent.setup()
    const view = await renderPage()

    await user.click(await screen.findByRole('button', { name: /Abrir IA no Terminal do Sistema/i }))

    await waitFor(() => {
      expect(mocks.abrirIaNoTerminal).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('IA ainda nao esta pronta')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Abrir Configuracoes/i })).toBeTruthy()
    expect(view.container.querySelectorAll('input, textarea')).toHaveLength(0)
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})
