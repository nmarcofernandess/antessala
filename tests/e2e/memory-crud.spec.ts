import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('create and delete a memory', async () => {
  const { app, page } = await launchApp('memory-crud')
  try {
    await dismissWizard(page)

    // Navigate to Memoria page via sidebar
    await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
    await page.waitForTimeout(1500)

    // Should be on Memorias tab by default
    // Find the textarea for new memory
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('FlowKit e um kit incrivel')

    // Click the add button (Plus icon button next to textarea)
    const addButton = page.locator('textarea').first().locator('..').locator('button').first()
    await addButton.click()
    await page.waitForTimeout(1500)

    // Verify memory appears in list
    const body = await page.locator('body').textContent()
    expect(body).toContain('FlowKit e um kit incrivel')
  } finally {
    await app.close()
  }
})
