import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('Maiá MVP — honestidade capability-aware', () => {
  test('surfaces honest gating on /maia and the "Voz da Maiá" card in Configuracoes', async () => {
    const { app, page } = await launchApp('maia-mvp')
    try {
      await dismissWizard(page)

      // /maia — ações núcleo presentes
      await page.locator('[data-sidebar="menu-button"] >> text=Maia').click()
      await page.waitForTimeout(1000)
      await expect(page.getByRole('button', { name: 'Falar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Perguntar' })).toBeVisible()

      // Gating honesto de visão: sem mmproj/Screen Recording, screenshot fica off declarado
      await expect(page.getByText('visão indisponível', { exact: false })).toBeVisible()

      // /configuracoes — card "Voz da Maiá" com Testar voz
      await page.locator('[data-sidebar="menu-button"] >> text=Configuracoes').click()
      await page.waitForTimeout(1000)
      await expect(page.getByText('Voz da Maiá', { exact: false })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Testar voz' })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
