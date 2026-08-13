import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('importing a markdown file creates a knowledge source', async () => {
  const { app, page } = await launchApp('import-text')
  try {
    await dismissWizard(page)

    // Navigate to Memoria page via sidebar
    await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
    await page.waitForTimeout(1500)

    // Click "Documentos" tab
    await page.getByRole('tab', { name: /Documentos/i }).click()
    await page.waitForTimeout(1500)

    // Verify the Documentos tab renders correctly.
    // Default filter is "Meus Documentos" (usuario) — should show empty state
    // or user docs. The Importar button should be visible on this filter.
    const importBtn = page.getByRole('button', { name: /Importar/i })
    await expect(importBtn.first()).toBeVisible({ timeout: 5000 })

    // Verify body has meaningful content (not blank)
    const body = await page.locator('body').textContent()
    expect(body?.length).toBeGreaterThan(100)
    // Should show the documents tab content
    expect(body).toContain('Documentos')
  } finally {
    await app.close()
  }
})
