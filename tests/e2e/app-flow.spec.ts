import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('Antessala boots offline and exposes the role-scoped MVP shell', async () => {
  const { app, page, dbPath } = await launchApp('mvp-shell')
  try {
    await expect(page).toHaveTitle('Antessala')
    await expect(page.getByRole('heading', { name: 'Antessala' })).toBeVisible()
    await expect(page.getByText('Demonstração local')).toBeVisible()
    await page.getByRole('button', { name: 'Entrar como Recepção' }).click()

    await expect(page.getByRole('heading', { name: 'Recepção Demo' })).toBeVisible()
    await expect(page.getByText('Novo encaminhamento', { exact: true })).toBeVisible()
    await expect(page.locator('[data-sidebar="menu-button"]')).toHaveText(['Operação'])
    await expect(page.getByText('Assistente IA', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /Registrar e encaminhar/ }).click()
    await expect(page.getByText(/Encaminhamento registrado/)).toBeVisible()
    await expect(page.getByText('Nenhum caso exige ação da recepção.')).toBeVisible()

    const light = page.getByRole('radio', { name: 'Tema claro' })
    const dark = page.getByRole('radio', { name: 'Tema escuro' })
    const system = page.getByRole('radio', { name: 'Tema sistema' })
    await light.click(); await expect(page.locator('html')).toHaveClass(/\blight\b/)
    await dark.click(); await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await system.click(); await expect(system).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('button', { name: 'Sair' }).click()
    await page.getByRole('button', { name: 'Entrar como Administração' }).click()
    await expect(page.locator('[data-sidebar="menu-button"]')).toHaveText(['Operação', 'Configurações'])
    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Configurações' }).click()
    await expect(page.getByText('Google Gemini')).toBeVisible()
    await expect(page.getByText(/Gemini opcional/)).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
