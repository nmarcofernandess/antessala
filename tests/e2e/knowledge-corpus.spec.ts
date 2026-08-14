import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('a Memória nasce com o corpus enriquecido e o grafo pronto em uma base vazia', async () => {
  let { app, page, dbPath } = await launchApp('knowledge-corpus')

  try {
    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Memória' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/memoria')
    await expect(page.getByRole('heading', { name: 'Memória' })).toBeVisible()

    const documentsMetric = page.getByText('Documentos', { exact: true }).locator('../..')
    await expect(documentsMetric.getByText('10', { exact: true })).toBeVisible()
    await expect(page.getByText('Cirurgia segura: três pausas que organizam a equipe')).toBeVisible()
    await expect(page.getByText('Prevenção de Infecções Relacionadas à Assistência à Saúde')).toBeVisible()
    await expect(page.getByText('Higiene das mãos em serviços de saúde')).toBeVisible()
    await expect(page.getByRole('button', { name: /Exemplos/i })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /Chunks/i })).toHaveCount(0)

    await page.getByText('Cirurgia segura: três pausas que organizam a equipe').click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/#\/memoria\/documentos\/\d+/)
    let title = page.getByRole('textbox', { name: 'Título' })
    await expect(title).toHaveValue('Cirurgia segura: três pausas que organizam a equipe')
    await title.fill('Cirurgia segura — versão editada')
    await expect(page.getByRole('status')).toContainText('Salvo · revisão 2', { timeout: 5_000 })

    await app.close()
    ;({ app, page } = await launchApp('knowledge-corpus-restart', dbPath))
    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Memória' }).click()
    await expect(page.getByText('Cirurgia segura — versão editada')).toBeVisible()
    await page.getByText('Cirurgia segura — versão editada').click()
    title = page.getByRole('textbox', { name: 'Título' })
    await page.getByRole('button', { name: /Versões/i }).click()
    await expect(page.getByText(/Revisão 1 · Cirurgia segura: três pausas/)).toBeVisible()
    await page.getByRole('button', { name: /Restaurar/i }).last().click()
    await page.keyboard.press('Escape')
    await expect(title).toHaveValue('Cirurgia segura: três pausas que organizam a equipe')
    await expect(page.getByRole('status')).toContainText('Salvo · revisão 3')

    await page.getByRole('button', { name: /Biblioteca/i }).click()

    await page.getByRole('tab', { name: /Grafo/i }).click()
    await expect(page.getByText(/\d+ conceitos · \d+ relações/)).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
