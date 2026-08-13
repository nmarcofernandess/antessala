import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('sidebar navigation', () => {
  test('clicking nav items navigates to each page', async () => {
    const { app, page } = await launchApp('sidebar-nav')
    try {
      await dismissWizard(page)

      // Helper: get current hash from location inside the renderer
      const getHash = () => page.evaluate(() => window.location.hash)

      // Dashboard — hash can be "" or "#/" on initial load
      const initialHash = await getHash()
      expect(initialHash === '' || initialHash === '#/').toBe(true)

      // Memoria — use sidebar link (has data-sidebar attribute)
      await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/memoria')

      // Assistente IA
      await page.locator('[data-sidebar="menu-button"] >> text=Assistente IA').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/ia')

      // Maia
      await page.locator('[data-sidebar="menu-button"] >> text=Maia').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/maia')

      // Galeria
      await page.locator('[data-sidebar="menu-button"] >> text=Galeria').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/galeria')

      // Configuracoes
      await page.locator('[data-sidebar="menu-button"] >> text=Configuracoes').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/configuracoes')

      // Back to Painel
      await page.locator('[data-sidebar="menu-button"] >> text=Painel').click()
      await page.waitForTimeout(1000)
      expect(await getHash()).toBe('#/')
    } finally {
      await app.close()
    }
  })
})
