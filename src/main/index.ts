import path from 'node:path'
import electron from 'electron'
import { createTables } from './db/schema'
import { seedData } from './db/seed'
import { initDb, closeDb } from './db/pglite'
import { APP_CONFIG } from './config/app-config'
import { shouldShowMainWindow } from './headless'
import { installRendererNetworkPolicy, isAllowedExternalUrl } from './renderer-network-policy'
import { seedMvpData } from './mvp/service'

process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EPIPE') console.error(err)
})
process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EPIPE') console.error(err)
})
process.on('uncaughtException', (err: Error) => {
  if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
    console.error('[MAIN] uncaughtException:', err)
  }
})

let mainWindow: import('electron').BrowserWindow | null = null

function createWindow(
  app: import('electron').App,
  BrowserWindow: typeof import('electron').BrowserWindow,
  shell: typeof import('electron').shell,
): void {
  const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  const iconExt = process.platform === 'win32' ? 'ico' : process.platform === 'darwin' ? 'icns' : 'png'

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: APP_CONFIG.name,
    icon: path.join(resourcesDir, `icon.${iconExt}`),
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  installRendererNetworkPolicy(mainWindow.webContents.session, process.env.ELECTRON_RENDERER_URL)

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Em desenvolvimento, aproveita uma chave já presente no ambiente. Esta etapa
 * só escreve no PGlite; testar a chave e conversar continuam sendo ações
 * explícitas do usuário.
 */
async function maybeSeedIaConfig(): Promise<void> {
  try {
    if (electron.app.isPackaged) return

    const { queryOne, execute } = await import('./db/query')
    const { PROVIDER_DEFAULTS, shouldAutoSeedIaConfig } = await import('./ia/config')
    const geminiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
    if (!geminiKey) return

    const provider = 'gemini' as const
    const apiKey = geminiKey
    const modelo = PROVIDER_DEFAULTS[provider]
    const current = await queryOne<{
      provider: 'gemini' | 'openrouter'
      api_key: string
      provider_configs_json?: string
    }>('SELECT provider, api_key, provider_configs_json FROM configuracao_ia WHERE id = 1')
    if (!shouldAutoSeedIaConfig(current)) return

    await execute(
      `INSERT INTO configuracao_ia (id, provider, api_key, modelo, provider_configs_json, ativo, memoria_automatica)
       VALUES (1, $1, $2, $3, $4, TRUE, FALSE)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key = EXCLUDED.api_key,
         modelo = EXCLUDED.modelo,
         provider_configs_json = EXCLUDED.provider_configs_json,
         ativo = TRUE,
         memoria_automatica = FALSE,
         atualizado_em = NOW()`,
      provider,
      apiKey,
      modelo,
      JSON.stringify({ [provider]: { token: apiKey, modelo } }),
    )
    console.log(`[IA] Configuração local carregada do ambiente: ${provider} (${modelo}).`)
  } catch (error) {
    console.warn('[IA] Não foi possível carregar a configuração do ambiente:', (error as Error).message)
  }
}

function installApplicationMenu(app: import('electron').App): void {
  const { Menu } = electron
  const appName = app.name === 'Electron' ? APP_CONFIG.name : app.name
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: appName,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Editar',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
        ],
      },
      {
        label: 'Janela',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { role: 'resetZoom' },
          { type: 'separator' },
          { role: 'close' },
        ],
      },
    ]),
  )
}

async function bootstrap(): Promise<void> {
  const { app, BrowserWindow, shell } = electron
  app.setName(APP_CONFIG.name)

  await initDb()
  await createTables()
  await maybeSeedIaConfig()
  await seedData()
  await seedMvpData()

  await app.whenReady()
  installApplicationMenu(app)

  const { registerIpcMain } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')
  const { router } = await import('./tipc')
  registerIpcMain(router)
  createWindow(app, BrowserWindow, shell)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(app, BrowserWindow, shell)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    void closeDb().catch(() => undefined)
  })
}

void bootstrap().catch(async (error) => {
  console.error('[MAIN] Falha no bootstrap:', error)
  await closeDb().catch(() => undefined)
  process.exit(1)
})
