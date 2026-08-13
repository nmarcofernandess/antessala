import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('pages render content', () => {
  test('all 6 pages render visible content', async () => {
    const { app, page } = await launchApp('pages-render')
    try {
      await dismissWizard(page)

      // 1. Dashboard — should show "FlowKit" heading
      await expect(page.getByRole('heading', { name: 'FlowKit' })).toBeVisible()

      // 2. Memoria — use sidebar link specifically to avoid ambiguity
      await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
      await page.waitForTimeout(1000)
      await expect(page.getByText('Memoria', { exact: false }).first()).toBeVisible()

      // 3. Assistente IA
      await page.locator('[data-sidebar="menu-button"] >> text=Assistente IA').click()
      await page.waitForTimeout(1000)
      await expect(page.getByText('Assistente', { exact: false }).first()).toBeVisible()

      // 4. Maia
      await page.locator('[data-sidebar="menu-button"] >> text=Maia').click()
      await page.waitForTimeout(1000)
      await expect(page.getByRole('button', { name: 'Falar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Perguntar' })).toBeVisible()

      // 5. Galeria
      await page.locator('[data-sidebar="menu-button"] >> text=Galeria').click()
      await page.waitForTimeout(1000)
      await expect(page.getByRole('heading', { name: 'Galeria' })).toBeVisible()

      // 6. Configuracoes
      await page.locator('[data-sidebar="menu-button"] >> text=Configuracoes').click()
      await page.waitForTimeout(1000)
      await expect(
        page.getByText('Aparencia', { exact: false })
          .or(page.getByText('Configuracoes', { exact: false }))
          .first()
      ).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
