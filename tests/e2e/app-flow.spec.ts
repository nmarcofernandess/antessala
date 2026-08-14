import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

test('Antessala exposes the integrated shell, isolated Assistant and three theme modes', async () => {
  const { app, page, dbPath } = await launchApp('active-shell')

  try {
    await expect(page).toHaveTitle('Antessala')
    await expect(page.getByRole('heading', { name: 'Painel do dia' })).toBeVisible()
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)

    // A lateral carrega o fluxo do caso. Configuração e tema saíram dela para o
    // menu da conta, no rodapé — por isso a contagem é de links, não de botões.
    const navItems = page.locator('a[data-sidebar="menu-button"]')
    await expect(navItems).toHaveCount(6)
    await expect(navItems).toHaveText([
      'Início',
      'Novo encaminhamento',
      'Agenda',
      'Repertório',
      'Assistente',
      'Memória',
    ])

    const hrefs = await navItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')),
    )
    expect(hrefs).toEqual([
      '#/',
      '#/casos/novo',
      '#/agenda',
      '#/repertorio',
      '#/assistente',
      '#/memoria',
    ])

    await navItems.filter({ hasText: 'Assistente' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/assistente')
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()

    await page.getByRole('button', { name: 'Menu da conta' }).click()
    await page.getByRole('menuitem', { name: 'Configurações' }).click()
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

    // Os três temas vivem no submenu do menu da conta. Abrir pelo teclado é
    // determinístico e prova de quebra que o menu é navegável sem mouse.
    async function escolherTema(rotulo: 'Claro' | 'Escuro' | 'Sistema') {
      await page.getByRole('button', { name: 'Menu da conta' }).click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowRight')
      const opcao = page.getByRole('menuitemradio', { name: rotulo })
      await expect(opcao).toBeVisible()
      await opcao.click()
    }

    await escolherTema('Claro')
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('light')

    await escolherTema('Escuro')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('dark')

    await escolherTema('Sistema')
    expect(await page.evaluate(() => localStorage.getItem('antessala-theme'))).toBe('system')

    await page.getByRole('button', { name: 'Menu da conta' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Sistema' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Tema' })).toBeVisible()
    await page.keyboard.press('Escape')
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
