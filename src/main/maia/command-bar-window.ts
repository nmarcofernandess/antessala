import { existsSync } from 'node:fs'
import path from 'node:path'
import { BrowserWindow } from 'electron'

let commandBarWindow: BrowserWindow | null = null

function firstExisting(paths: string[]): string {
  return paths.find((candidate) => existsSync(candidate)) ?? paths[0]
}

function getPreloadPath(): string {
  return firstExisting([
    path.join(__dirname, '../preload/index.mjs'),
    path.join(__dirname, '../../preload/index.mjs'),
  ])
}

function getRendererIndexPath(): string {
  return firstExisting([
    path.join(__dirname, '../renderer/index.html'),
    path.join(__dirname, '../../renderer/index.html'),
  ])
}

function getCommandBarUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/#/maia-bar`
  }
  return ''
}

function createCommandBarWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 128,
    minWidth: 520,
    minHeight: 96,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Maia',
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      preload: getPreloadPath(),
    },
  })

  const devUrl = getCommandBarUrl()
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(getRendererIndexPath(), { hash: '/maia-bar' })
  }

  return win
}

export async function openMaiaCommandBar(): Promise<{ opened: true }> {
  if (!commandBarWindow || commandBarWindow.isDestroyed()) {
    commandBarWindow = createCommandBarWindow()
  }
  commandBarWindow.setAlwaysOnTop(true, 'floating')
  commandBarWindow.show()
  commandBarWindow.focus()
  return { opened: true }
}

export async function closeMaiaCommandBar(): Promise<{ closed: true }> {
  if (commandBarWindow && !commandBarWindow.isDestroyed()) {
    commandBarWindow.hide()
  }
  return { closed: true }
}
