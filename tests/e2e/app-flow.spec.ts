import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('Antessala exposes the integrated shell, isolated Assistant and three theme modes', async () => {
  const { app, page, dbPath } = await launchApp('active-shell')

  try {
    await expect(page).toHaveTitle('Antessala')
    await expect(page.getByRole('heading', { name: 'Painel do dia' })).toBeVisible()
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)

    const navItems = page.locator('[data-sidebar="menu-button"]')
    await expect(navItems).toHaveCount(8)
    await expect(navItems).toHaveText([
      'Início',
      'Novo encaminhamento',
      'Triagem',
      'Agenda',
      'Repertório',
      'Assistente',
      'Memória',
      'Configurações',
    ])

    const hrefs = await navItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')),
    )
    expect(hrefs).toEqual([
      '#/',
      '#/casos/novo',
      '#/triagem',
      '#/agenda',
      '#/repertorio',
      '#/assistente',
      '#/memoria',
      '#/configuracoes',
    ])

    await navItems.filter({ hasText: 'Assistente' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/assistente')
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()

    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Configurações' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/configuracoes')
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
    await expect(page.getByText('Google Gemini', { exact: true })).toBeVisible()

    await page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Início' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/')

    await expect(page.locator('#ia-toggle')).toHaveCount(0)

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
