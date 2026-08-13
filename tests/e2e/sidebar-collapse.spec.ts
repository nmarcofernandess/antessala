import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('sidebar collapse', () => {
  test('sidebar trigger toggles collapsed state', async () => {
    const { app, page } = await launchApp('sidebar-collapse')
    try {
      await dismissWizard(page)

      const sidebar = page.locator('[data-sidebar="sidebar"]').first()
      const trigger = page.locator('[data-sidebar="trigger"]').first()

      // Sidebar should start expanded
      await expect(sidebar).toBeVisible()
      const initialWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
      expect(initialWidth).toBeGreaterThan(100)

      // Click trigger to collapse
      await trigger.click()
      await page.waitForTimeout(500)

      const collapsedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
      expect(collapsedWidth).toBeLessThan(initialWidth)

      // Click trigger to expand again
      await trigger.click()
      await page.waitForTimeout(500)

      const expandedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
      expect(expandedWidth).toBeGreaterThan(collapsedWidth)
    } finally {
      await app.close()
    }
  })
})
