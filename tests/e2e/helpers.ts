import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function launchApp(testName: string): Promise<{ app: ElectronApplication; page: Page }> {
  const dbPath = path.join(os.tmpdir(), `flowkit-e2e-${testName}-${Date.now()}`)
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true })

  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      FLOWKIT_DB_PATH: dbPath,
      NODE_ENV: 'test',
    },
    timeout: 30000,
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)

  return { app, page }
}

export async function launchAppWithDb(dbPath: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      FLOWKIT_DB_PATH: dbPath,
      NODE_ENV: 'test',
    },
    timeout: 30000,
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)

  return { app, page }
}

/**
 * Dismiss the setup wizard if it appears.
 * Clicks "Pular setup" on step 1 of the onboarding dialog.
 */
export async function dismissWizard(page: Page): Promise<void> {
  const skipBtn = page.getByRole('button', { name: 'Pular setup' })
  try {
    await skipBtn.waitFor({ state: 'visible', timeout: 5000 })
    await skipBtn.click()
    await page.waitForTimeout(500)
  } catch {
    // Wizard not shown — already dismissed or second boot
  }
}
