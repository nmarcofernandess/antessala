import { test, expect } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function makeLauncher(dbPath: string) {
  return async () => {
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
}

test.describe('setup wizard', () => {
  test('wizard shows on first boot, not on second boot after skip', async () => {
    const dbPath = path.join(os.tmpdir(), `flowkit-e2e-wizard-${Date.now()}`)
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true })

    const launch = makeLauncher(dbPath)

    // First boot — wizard should appear
    const { app: app1, page: page1 } = await launch()
    try {
      // The wizard Dialog renders with "FlowKit" title text on step 1
      const wizardContent = page1.locator('[role="dialog"]')
      await expect(wizardContent).toBeVisible({ timeout: 10000 })

      // Verify it contains FlowKit text
      await expect(wizardContent.getByText('FlowKit')).toBeVisible()

      // Click "Pular setup" to dismiss
      const skipBtn = page1.getByRole('button', { name: 'Pular setup' })
      await expect(skipBtn).toBeVisible()
      await skipBtn.click()
      await page1.waitForTimeout(1000)

      // Wizard should be gone
      await expect(wizardContent).not.toBeVisible({ timeout: 5000 })
    } finally {
      await app1.close()
    }

    // Second boot with SAME DB — wizard should NOT appear
    const { app: app2, page: page2 } = await launch()
    try {
      await page2.waitForTimeout(2000)
      const wizardContent2 = page2.locator('[role="dialog"]')
      await expect(wizardContent2).not.toBeVisible({ timeout: 5000 })
    } finally {
      await app2.close()
    }
  })
})
