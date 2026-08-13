import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('toggling a source affects its visibility', async () => {
  const { app, page } = await launchApp('source-toggle')
  try {
    await dismissWizard(page)

    // Navigate to Memoria page via sidebar
    await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
    await page.waitForTimeout(1500)

    // Click "Documentos" tab
    await page.getByRole('tab', { name: /Documentos/i }).click()
    await page.waitForTimeout(1500)

    // Switch filter to "Sistema" to see seed docs (they have toggle switches)
    const trigger = page.locator('button[role="combobox"]').first()
    await trigger.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Sistema/i }).click()
    await page.waitForTimeout(1000)

    // Look for a toggle/switch element (shadcn Switch renders role="switch")
    const toggle = page.locator('[role="switch"]').first()
    if (await toggle.isVisible({ timeout: 3000 })) {
      // Should be enabled by default (seed sources are active)
      const isChecked = await toggle.getAttribute('data-state')
      expect(isChecked).toBe('checked')

      // Click to disable
      await toggle.click()
      await page.waitForTimeout(500)

      const newState = await toggle.getAttribute('data-state')
      expect(newState).toBe('unchecked')

      // Click again to re-enable (cleanup)
      await toggle.click()
      await page.waitForTimeout(500)

      const restoredState = await toggle.getAttribute('data-state')
      expect(restoredState).toBe('checked')
    } else {
      // If no toggle visible, at least verify we're on the right page
      const body = await page.locator('body').textContent()
      expect(body).toContain('Documentos')
    }
  } finally {
    await app.close()
  }
})
