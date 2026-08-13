import { test, expect } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { launchAppWithDb } from './helpers'

test('FlowKit core app flow runs in one desktop pass', async () => {
  const dbPath = path.join(os.tmpdir(), `flowkit-e2e-app-flow-${Date.now()}`)
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true })

  const { app, page } = await launchAppWithDb(dbPath)
  try {
    const goTo = async (hash: string) => {
      await page.locator(`a[href="${hash}"]`).first().click()
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hash)
    }

    const wizardContent = page.locator('[role="dialog"]')
    await expect(wizardContent).toBeVisible({ timeout: 10000 })
    await expect(wizardContent.getByText('FlowKit')).toBeVisible()
    await page.getByRole('button', { name: 'Pular setup' }).click()
    await expect(wizardContent).not.toBeVisible({ timeout: 5000 })

    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toBeTruthy()
    expect(htmlClass!.includes('dark') || htmlClass!.includes('light')).toBe(true)

    await expect(page.getByRole('heading', { name: 'FlowKit' })).toBeVisible()
    await expect(page.getByText('Conectado').first()).toBeVisible()
    for (const label of ['Fontes', 'Fragmentos', 'Entidades', 'Memorias']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    const sidebar = page.locator('[data-sidebar="sidebar"]').first()
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]').first()
    const expandedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
    expect(expandedWidth).toBeGreaterThan(100)
    await sidebarTrigger.click()
    await page.waitForTimeout(500)
    const collapsedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
    expect(collapsedWidth).toBeLessThan(expandedWidth)
    await sidebarTrigger.click()
    await page.waitForTimeout(500)

    const getIaPanelWidth = () =>
      page.evaluate(() => {
        const allDivs = document.querySelectorAll('div[style]')
        for (const div of allDivs) {
          if ((div as HTMLElement).style.width === '380px') {
            return Math.round(div.parentElement?.getBoundingClientRect().width ?? -1)
          }
        }
        return -1
      })

    expect(await getIaPanelWidth()).toBeLessThanOrEqual(1)
    await page.locator('#ia-toggle').click()
    await page.waitForTimeout(1000)
    expect(await getIaPanelWidth()).toBeGreaterThan(100)
    await page.locator('#ia-toggle').click()
    await page.waitForTimeout(500)
    expect(await getIaPanelWidth()).toBeLessThanOrEqual(1)

    await goTo('#/memoria')
    const memoryText = `FlowKit app-flow ${Date.now()}`
    const memoryTextarea = page.locator('textarea').first()
    await expect(memoryTextarea).toBeVisible({ timeout: 5000 })
    await memoryTextarea.fill(memoryText)
    await memoryTextarea.locator('..').locator('button').first().click()
    await expect(page.getByText(memoryText)).toBeVisible({ timeout: 5000 })

    await page.getByRole('tab', { name: /Documentos/i }).click()
    await expect(page.getByRole('button', { name: /Importar/i }).first()).toBeVisible({ timeout: 5000 })
    const filterTrigger = page.locator('button[role="combobox"]').first()
    await filterTrigger.click()
    await page.getByRole('option', { name: /Sistema/i }).click()
    await page.waitForTimeout(1000)
    const documentosBody = await page.locator('body').textContent()
    expect(documentosBody?.includes('chunks') || documentosBody?.includes('Nenhum documento de sistema')).toBe(true)

    await page.getByRole('tab', { name: /Avancado/i }).click()
    await expect(page.getByText('RAG Playground')).toBeVisible()

    await goTo('#/ia')
    await expect(page.locator('main textarea').first()).toBeVisible({ timeout: 5000 })

    await goTo('#/maia')
    await expect(page.getByRole('button', { name: 'Falar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resumir' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Perguntar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir barra Maia' })).toBeVisible()

    await page.evaluate(() => { window.location.hash = '#/maia-bar' })
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/maia-bar')
    await expect(page.getByPlaceholder('Pergunte ou escolha uma acao')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Responder' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clipboard' })).toBeVisible()

    await page.evaluate(() => { window.location.hash = '#/galeria' })
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/galeria')
    await expect(page.getByRole('heading', { name: 'Galeria' })).toBeVisible()

    await goTo('#/configuracoes')
    const configBody = await page.locator('body').textContent()
    expect(configBody).toContain('Backup')
    expect(configBody?.includes('Aparencia') || configBody?.includes('Configuracoes')).toBe(true)

    await goTo('#/')
  } finally {
    await app.close()
  }

  const secondBoot = await launchAppWithDb(dbPath)
  try {
    await expect(secondBoot.page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
  } finally {
    await secondBoot.app.close()
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true })
  }
})
