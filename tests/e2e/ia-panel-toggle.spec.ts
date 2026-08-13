import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('IA panel toggle', () => {
  test('IA toggle button opens and closes the chat panel', async () => {
    const { app, page } = await launchApp('ia-panel-toggle')
    try {
      await dismissWizard(page)

      // Verify we're on Dashboard (not /ia where toggle is hidden)
      const hash = await page.evaluate(() => window.location.hash)
      expect(hash === '' || hash === '#/').toBe(true)

      // The IA panel outer div has transition-[width] class.
      // When closed: w-0, border-l-0. When open: w-[380px], border-l.
      // We find it by looking for the div that contains the inner panel with style width:380.
      const getIaPanelWidth = () =>
        page.evaluate(() => {
          // The inner div has inline style width:380px
          const allDivs = document.querySelectorAll('div[style]')
          for (const div of allDivs) {
            if ((div as HTMLElement).style.width === '380px') {
              const outer = div.parentElement
              if (outer) return Math.round(outer.getBoundingClientRect().width)
            }
          }
          return -1
        })

      // Panel should start closed (width ~ 0)
      const initialWidth = await getIaPanelWidth()
      expect(initialWidth).toBeLessThanOrEqual(1)

      // Click the IA toggle button (id="ia-toggle" in PageHeader)
      await page.locator('#ia-toggle').click()
      await page.waitForTimeout(1500)

      const openWidth = await getIaPanelWidth()
      expect(openWidth).toBeGreaterThan(100)

      // Click again to close
      await page.locator('#ia-toggle').click()
      await page.waitForTimeout(1500)

      const closedWidth = await getIaPanelWidth()
      expect(closedWidth).toBeLessThanOrEqual(1)
    } finally {
      await app.close()
    }
  })
})
