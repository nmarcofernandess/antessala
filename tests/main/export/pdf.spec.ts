import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  BrowserWindow: vi.fn(),
  showSaveDialog: vi.fn(),
  loadURL: vi.fn(),
  printToPDF: vi.fn(),
  onBeforeRequest: vi.fn(),
  isDestroyed: vi.fn(() => false),
  destroy: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('electron', () => ({
  default: {
    BrowserWindow: mocks.BrowserWindow,
    dialog: { showSaveDialog: mocks.showSaveDialog },
  },
}))

vi.mock('node:fs/promises', () => ({
  writeFile: mocks.writeFile,
}))

const { exportHtmlToPdf, PDF_BLOCKED_NETWORK_URLS } = await import(
  '../../../src/main/export/pdf'
)

describe('exportHtmlToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/resumo.pdf',
    })
    mocks.loadURL.mockResolvedValue(undefined)
    mocks.printToPDF.mockResolvedValue(Buffer.from('pdf'))
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.isDestroyed.mockReturnValue(false)
    mocks.BrowserWindow.mockImplementation(function BrowserWindowMock() {
      return {
        loadURL: mocks.loadURL,
        isDestroyed: mocks.isDestroyed,
        destroy: mocks.destroy,
        webContents: {
          printToPDF: mocks.printToPDF,
          session: { webRequest: { onBeforeRequest: mocks.onBeforeRequest } },
        },
      }
    })
  })

  it('renders HTML to PDF in an isolated offline Electron window', async () => {
    const html = '<html><body><h1>Resumo clínico</h1></body></html>'

    await expect(exportHtmlToPdf({ html })).resolves.toEqual({
      filepath: '/tmp/resumo.pdf',
    })

    expect(mocks.BrowserWindow).toHaveBeenCalledWith({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: expect.objectContaining({
        partition: expect.stringMatching(/^antessala-pdf-/),
        offscreen: true,
        javascript: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      }),
    })
    expect(mocks.loadURL).toHaveBeenCalledWith(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    )
    expect(mocks.printToPDF).toHaveBeenCalledWith({
      pageSize: 'A4',
      landscape: true,
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })
    expect(mocks.writeFile).toHaveBeenCalledWith('/tmp/resumo.pdf', Buffer.from('pdf'))
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })

  it('blocks every HTTP, HTTPS and WebSocket request before loading the HTML', async () => {
    await exportHtmlToPdf({ html: '<img src="https://example.com/image.png">' })

    const [filter, listener] = mocks.onBeforeRequest.mock.calls[0] as [
      { urls: string[] },
      (_details: unknown, callback: (response: { cancel: boolean }) => void) => void,
    ]
    const callback = vi.fn()
    listener({ url: 'https://example.com/image.png' }, callback)

    expect(filter).toEqual({ urls: [...PDF_BLOCKED_NETWORK_URLS] })
    expect(callback).toHaveBeenCalledWith({ cancel: true })
  })

  it('honors portrait output when landscape is false', async () => {
    await exportHtmlToPdf({ html: '<p>Retrato</p>', landscape: false })

    expect(mocks.printToPDF).toHaveBeenCalledWith(
      expect.objectContaining({ landscape: false }),
    )
  })

  it('does not create a window when the save dialog is canceled', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: true })

    await expect(exportHtmlToPdf({ html: '<p>Não imprimir</p>' })).resolves.toBeNull()

    expect(mocks.BrowserWindow).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('removes the network hook and destroys the window when printing fails', async () => {
    mocks.printToPDF.mockRejectedValue(new Error('falha de impressão'))

    await expect(exportHtmlToPdf({ html: '<p>Falha</p>' })).rejects.toThrow(
      'falha de impressão',
    )

    expect(mocks.onBeforeRequest.mock.calls.at(-1)).toEqual([null])
    expect(mocks.destroy).toHaveBeenCalledOnce()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('destroys the window even if installing the network hook fails', async () => {
    mocks.onBeforeRequest.mockImplementationOnce(() => {
      throw new Error('falha ao instalar bloqueio')
    })

    await expect(exportHtmlToPdf({ html: '<p>Falha cedo</p>' })).rejects.toThrow(
      'falha ao instalar bloqueio',
    )

    expect(mocks.loadURL).not.toHaveBeenCalled()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })

  it('does not destroy an already-destroyed window during cleanup', async () => {
    mocks.isDestroyed.mockReturnValue(true)

    await exportHtmlToPdf({ html: '<p>Pronto</p>' })

    expect(mocks.onBeforeRequest.mock.calls.at(-1)).toEqual([null])
    expect(mocks.destroy).not.toHaveBeenCalled()
  })
})
