import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('a Memória nasce com o corpus enriquecido e o grafo pronto em uma base vazia', async () => {
  const { app, page, dbPath } = await launchApp('knowledge-corpus')

  try {
    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Memória' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/memoria')
    await expect(page.getByRole('heading', { name: 'Memória' })).toBeVisible()

    const sourcesMetric = page.getByText('Fontes', { exact: true }).locator('../..')
    await expect(sourcesMetric.getByText('10', { exact: true })).toBeVisible()
    await expect(page.getByText('Cirurgia segura: três pausas que organizam a equipe')).toBeVisible()
    await expect(page.getByText('Higiene das mãos em serviços de saúde')).toBeVisible()
    await expect(page.getByRole('button', { name: /Exemplos/i })).toHaveCount(0)

    await page.getByRole('tab', { name: /Grafo/i }).click()
    await expect(page.getByText(/\d+ nós · \d+ relações/)).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
