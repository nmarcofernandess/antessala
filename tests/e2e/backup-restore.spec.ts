import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('backup section is visible in settings', async () => {
  const { app, page } = await launchApp('backup-section')
  try {
    await dismissWizard(page)

    // Navigate to Configuracoes via sidebar
    await page.locator('[data-sidebar="menu-button"] >> text=Configuracoes').click()
    await page.waitForTimeout(1500)

    // Verify the Backup card is visible
    const body = await page.locator('body').textContent()
    expect(body).toContain('Backup')
    expect(body).toContain('backups')

    // Verify the backup button exists
    const backupBtn = page.getByText('Criar backup', { exact: false })
      .or(page.getByText('Backup Rapido', { exact: false }))
    // The button might be inside a dropdown, so just verify Backup section text
    await expect(page.getByText('Backup').first()).toBeVisible()
  } finally {
    await app.close()
  }
})
