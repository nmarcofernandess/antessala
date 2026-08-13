import path from 'node:path'
import electron from 'electron'
import { createTables } from './db/schema'
import { seedData } from './db/seed'
import { initDb, closeDb } from './db/pglite'
import { startToolServer, stopToolServer } from './tool-server'
import { APP_CONFIG } from './config/app-config'
import { shouldShowMainWindow } from './headless'

process.stdout.on('error', (err: NodeJS.ErrnoException) => { if (err.code !== 'EPIPE') console.error(err) })
process.stderr.on('error', (err: NodeJS.ErrnoException) => { if (err.code !== 'EPIPE') console.error(err) })
process.on('uncaughtException', (err: Error) => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') return
  console.error('[MAIN] uncaughtException:', err)
})

let mainWindow: import('electron').BrowserWindow | null = null

function parseBooleanConfig(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    try {
      return Boolean(JSON.parse(value))
    } catch {
      return fallback
    }
  }
  return fallback
}

function createWindow(
  app: import('electron').App,
  BrowserWindow: typeof import('electron').BrowserWindow,
  shell: typeof import('electron').shell,
): void {
  const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  const iconExt = process.platform === 'win32' ? 'ico' : process.platform === 'darwin' ? 'icns' : 'png'
  const iconPath = path.join(resourcesDir, `icon.${iconExt}`)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: APP_CONFIG.name,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/index.mjs'),
    },
  })

  mainWindow.on('ready-to-show', () => {
    if (shouldShowMainWindow()) mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/** DEV: auto-seed IA config from env vars if not yet configured */
async function maybeSeedIaConfig(): Promise<void> {
  try {
    const { app } = await import('electron')
    if (app.isPackaged) return

    const { queryOne, execute } = await import('./db/query')
    const { PROVIDER_DEFAULTS, shouldAutoSeedIaConfig } = await import('./ia/config')

    const geminiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
    const orKey = process.env.OPENROUTER_API_KEY?.trim()
    if (!geminiKey && !orKey) return

    const provider = geminiKey ? 'gemini' as const : 'openrouter' as const
    const key = geminiKey ?? orKey!
    const model = PROVIDER_DEFAULTS[provider]
    const configs = JSON.stringify({
      gemini: { token: geminiKey ?? '', modelo: PROVIDER_DEFAULTS.gemini },
      openrouter: { token: orKey ?? '', modelo: PROVIDER_DEFAULTS.openrouter },
    })

    const row = await queryOne<{ api_key: string; modelo: string; provider: 'gemini' | 'openrouter' | 'local'; provider_configs_json?: string }>(
      'SELECT api_key, modelo, provider, provider_configs_json FROM configuracao_ia WHERE id = 1',
    )
    if (!shouldAutoSeedIaConfig(row)) return
    if (row?.api_key === key && row?.modelo === model && row?.provider === provider) return

    await execute(
      `INSERT INTO configuracao_ia (id, provider, api_key, modelo, provider_configs_json, ativo, memoria_automatica)
       VALUES (1, $1, $2, $3, $4, TRUE, TRUE)
       ON CONFLICT (id) DO UPDATE SET provider=$1, api_key=$2, modelo=$3, provider_configs_json=$4, ativo=TRUE, atualizado_em=NOW()`,
      provider, key, model, configs,
    )
    console.log(`[IA] Auto-configured: ${provider} (${model}) from env vars`)
  } catch (err) {
    console.warn('[IA] Auto-seed failed (non-critical):', (err as Error).message)
  }
}

async function bootstrap(): Promise<void> {
  await initDb()
  await createTables()
  await maybeSeedIaConfig()
  startToolServer()

  const { app, BrowserWindow, shell, Menu, globalShortcut } = electron

  app.whenReady().then(async () => {
    // Menu: no macOS, primeiro item define o nome na barra
    const appName = app.name === 'Electron' ? APP_CONFIG.name : (app.name ?? APP_CONFIG.name)
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: appName,
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          { role: 'quit' as const },
        ],
      },
      {
        label: 'Editar',
        submenu: [
          { role: 'undo' as const }, { role: 'redo' as const },
          { type: 'separator' as const },
          { role: 'cut' as const }, { role: 'copy' as const }, { role: 'paste' as const },
        ],
      },
      {
        label: 'Janela',
        submenu: [
          { role: 'minimize' as const }, { role: 'zoom' as const },
          { type: 'separator' as const },
          { role: 'zoomIn' as const }, { role: 'zoomOut' as const }, { role: 'resetZoom' as const },
          { type: 'separator' as const },
          { role: 'close' as const },
        ],
      },
    ]))

    const { registerIpcMain } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')
    const { router } = await import('./tipc')
    registerIpcMain(router)
    createWindow(app, BrowserWindow, shell)
    const { registerMaiaHotkeys } = await import('./maia/hotkeys')
    registerMaiaHotkeys(globalShortcut)

    // Run seed in background (don't block window render)
    seedData().catch(err => console.error('[SEED] Failed:', err))

    // Cron: auto-run on start (5s delay) if enabled
    const cronAutoEnabled = await (async () => {
      try {
        const { queryOne } = await import('./db/query')
        const row = await queryOne<{ value: unknown }>(`SELECT value FROM config WHERE key = 'cron_auto_enabled'`)
        return parseBooleanConfig(row?.value, true)
      } catch { return true }
    })()

    if (cronAutoEnabled) {
      setTimeout(async () => {
        try {
          const { runCronPipeline } = await import('./cron/pipeline')
          await runCronPipeline()
        } catch (err) { console.warn('[CRON] Auto-run falhou:', (err as Error).message) }
      }, 5000)
    }

    // Cron: run on resume from sleep
    electron.powerMonitor.on('resume', () => {
      setTimeout(async () => {
        try {
          const { runCronPipeline } = await import('./cron/pipeline')
          await runCronPipeline()
        } catch (err) { console.warn('[CRON] Resume-run falhou:', (err as Error).message) }
      }, 3000)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(app, BrowserWindow, shell)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', async () => {
    const { globalShortcut } = electron
    void import('./maia/hotkeys').then(m => m.unregisterMaiaHotkeys(globalShortcut)).catch(() => {})
    stopToolServer()
    void import('./ia/local-llm').then(m => m.unloadModel()).catch(() => {})
    void closeDb().catch(() => {})
  })
}

bootstrap().catch(async (err) => {
  console.error('[MAIN] Falha no bootstrap:', err)
  await closeDb().catch(() => {})
  process.exit(1)
})
