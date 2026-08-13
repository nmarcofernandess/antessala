import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('Antessala exposes only its active shell, routes and three theme modes', async () => {
  const { app, page, dbPath } = await launchApp('active-shell')

  try {
    await expect(page).toHaveTitle('Antessala')
    await expect(page.getByRole('heading', { name: 'Antessala' })).toBeVisible()
    await expect(page.getByTestId('dashboard-skeleton')).toBeVisible()
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)

    const navItems = page.locator('[data-sidebar="menu-button"]')
    await expect(navItems).toHaveCount(3)
    await expect(navItems).toHaveText(['Início', 'Assistente IA', 'Configurações'])

    const hrefs = await navItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')),
    )
    expect(hrefs).toEqual(['#/', '#/ia', '#/configuracoes'])

    await navItems.filter({ hasText: 'Assistente IA' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/ia')
    await expect(page.getByRole('main').getByText('Assistente IA', { exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()

    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Configurações' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/configuracoes')
    await expect(page.getByText('Escolha um provedor cloud. Só um fica ativo por vez.')).toBeVisible()

    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Início' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/')

    const iaPanelWidth = () => page.evaluate(() => {
      const inner = [...document.querySelectorAll<HTMLElement>('div[style]')]
        .find((element) => element.style.width === '380px')
      return Math.round(inner?.parentElement?.getBoundingClientRect().width ?? -1)
    })
    expect(await iaPanelWidth()).toBeLessThanOrEqual(1)
    await page.locator('#ia-toggle').click()
    await expect.poll(iaPanelWidth).toBeGreaterThan(100)
    await page.locator('#ia-toggle').click()
    await expect.poll(iaPanelWidth).toBeLessThanOrEqual(1)

    const sidebar = page.locator('[data-sidebar="sidebar"]').first()
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]').first()
    if (await sidebar.evaluate((element) => element.getBoundingClientRect().width) < 100) {
      await sidebarTrigger.click()
      await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width))
        .toBeGreaterThan(100)
    }
    const expandedWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width)
    await sidebarTrigger.click()
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width))
      .toBeLessThan(expandedWidth)
    await sidebarTrigger.click()
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width))
      .toBeGreaterThan(100)

    const light = page.getByRole('radio', { name: 'Tema claro' })
    const dark = page.getByRole('radio', { name: 'Tema escuro' })
    const system = page.getByRole('radio', { name: 'Tema sistema' })

    await light.click()
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    await expect(light).toHaveAttribute('aria-checked', 'true')
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('light')

    await dark.click()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('dark')

    await system.click()
    await expect(system).toHaveAttribute('aria-checked', 'true')
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('system')
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
