import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  dbPath: string
}

export async function launchApp(testName: string, existingDbPath?: string): Promise<LaunchedApp> {
  const safeName = testName.replace(/[^a-z0-9-]/gi, '-')
  const dbPath = existingDbPath ?? fs.mkdtempSync(path.join(os.tmpdir(), `antessala-e2e-${safeName}-`))
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      ANTESSALA_DB_PATH: dbPath,
      NODE_ENV: 'test',
      // A janela existe (screenshot funciona), mas não sobe na frente de quem
      // está trabalhando. O main já sabia disso; faltava o teste pedir.
      ANTESSALA_HEADLESS: '1',
    },
    timeout: 30_000,
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 30_000 })

  return { app, page, dbPath }
}

export function removeAppData(dbPath: string): void {
  fs.rmSync(dbPath, { recursive: true, force: true })
}
