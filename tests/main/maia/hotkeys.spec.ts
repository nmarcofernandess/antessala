import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runLiteralReadAction: vi.fn(),
  openMaiaCommandBar: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}))

vi.mock('../../../src/main/maia/runtime-actions', () => ({
  runLiteralReadAction: mocks.runLiteralReadAction,
}))

vi.mock('../../../src/main/maia/command-bar-window', () => ({
  openMaiaCommandBar: mocks.openMaiaCommandBar,
}))

describe('Maia hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.register.mockReturnValue(true)
  })

  it('registers literal read and command bar shortcuts', async () => {
    const { registerMaiaHotkeys } = await import('../../../src/main/maia/hotkeys')

    registerMaiaHotkeys({
      register: mocks.register,
      unregister: mocks.unregister,
    } as any)

    expect(mocks.register).toHaveBeenCalledWith('Shift+Delete', expect.any(Function))
    expect(mocks.register).toHaveBeenCalledWith('CommandOrControl+Shift+Space', expect.any(Function))
  })

  it('reports hotkey status with accelerators and registration flags', async () => {
    const { registerMaiaHotkeys, getMaiaHotkeyStatus, MAIA_LITERAL_READ_ACCELERATOR, MAIA_COMMAND_BAR_ACCELERATOR } =
      await import('../../../src/main/maia/hotkeys')

    registerMaiaHotkeys({ register: mocks.register, unregister: mocks.unregister } as any)
    const status = getMaiaHotkeyStatus()

    expect(status.literalReading).toEqual({ accelerator: MAIA_LITERAL_READ_ACCELERATOR, registered: true })
    expect(status.commandBar).toEqual({ accelerator: MAIA_COMMAND_BAR_ACCELERATOR, registered: true })
    expect(MAIA_LITERAL_READ_ACCELERATOR).toBe('Shift+Delete')
    expect(MAIA_COMMAND_BAR_ACCELERATOR).toBe('CommandOrControl+Shift+Space')
  })
})
