import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  focus: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  isDestroyed: vi.fn(() => false),
  BrowserWindow: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/app',
  },
  BrowserWindow: mocks.BrowserWindow,
}))

describe('Maia command bar window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    mocks.BrowserWindow.mockImplementation(function BrowserWindowMock() {
      return {
      loadURL: mocks.loadURL,
      loadFile: mocks.loadFile,
      show: mocks.show,
      hide: mocks.hide,
      focus: mocks.focus,
      setAlwaysOnTop: mocks.setAlwaysOnTop,
      isDestroyed: mocks.isDestroyed,
      webContents: { send: vi.fn() },
      }
    })
  })

  it('creates a compact always-on-top command bar and opens it on the Maia route', async () => {
    const { openMaiaCommandBar } = await import('../../../src/main/maia/command-bar-window')

    const result = await openMaiaCommandBar()

    expect(result).toEqual({ opened: true })
    expect(mocks.BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 720,
      height: 128,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
    }))
    expect(mocks.loadURL).toHaveBeenCalledWith('http://localhost:5173/#/maia-bar')
    expect(mocks.show).toHaveBeenCalled()
    expect(mocks.focus).toHaveBeenCalled()
  })
})
