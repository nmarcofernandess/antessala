import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

/**
 * Regressão da vitrine dentro do app empacotado, em base vazia.
 *
 * O que precisa continuar verdadeiro depois da consolidação com a Memória: os
 * protocolos nascem no banco, a composição é editável, e o que a pessoa cadastra
 * sobrevive ao fechar o aplicativo.
 */
test('os protocolos nascem no banco, compõem a entrevista e sobrevivem ao reinício', async () => {
  let { app, page, dbPath } = await launchApp('repertorio-protocolos')

  try {
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Repertório' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/repertorio')

    // A fixture inteira foi gravada no primeiro boot.
    await expect(page.getByText('12 protocolos')).toBeVisible()
    await expect(page.getByText('Salvos no banco local do app.')).toBeVisible()

    // A composição muda com a cirurgia: facectomia coleta menos que artroplastia.
    await page.getByRole('button', { name: /Facectomia/ }).first().click()
    await expect(page.getByText('9 widgets · 1 procedimento')).toBeVisible()
    await page.getByRole('button', { name: /Artroplastia de quadril/ }).first().click()
    await expect(page.getByText('16 widgets · 1 procedimento')).toBeVisible()

    // Cadastrar uma cirurgia nova pelo drawer.
    await page.getByRole('button', { name: 'Nova cirurgia' }).first().click()
    await expect(page.getByText('A entrevista está vazia')).toBeVisible()
    await page.getByLabel('Cirurgia ou procedimento').fill('Cirurgia da prova E2E')
    await page.getByLabel('Regime e anestesia previstos').fill('Ambulatorial · sedação')
    await page.getByRole('button', { name: /Adicionar widget/ }).first().click()
    const painel = page.getByRole('dialog')
    await painel.getByRole('button', { name: /^Alergias/ }).click()
    await painel.getByRole('button', { name: /^Sinais vitais/ }).click()
    await painel.getByRole('button', { name: 'Concluir' }).click()
    await expect(page.getByText('2 widgets · 0 procedimentos')).toBeVisible()
    await page.getByRole('button', { name: /Salvar protocolo/ }).click()
    await expect(page.getByText('13 protocolos')).toBeVisible()

    // Reinício: a verdade é a tabela, não a fixture compilada.
    await app.close()
    ;({ app, page } = await launchApp('repertorio-protocolos-restart', dbPath))
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Repertório' }).click()
    await expect(page.getByText('13 protocolos')).toBeVisible()
    await expect(page.getByRole('button', { name: /Cirurgia da prova E2E/ })).toBeVisible()

    // O catálogo de widgets declara o uso real, e a herança continua declarada.
    await page.getByRole('tab', { name: 'Widgets' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/repertorio/widgets')
    await expect(page.getByRole('heading', { name: 'Widgets do Antessala' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Herança do DietFlow' })).toBeVisible()

    // A anamnese continua montando pelo protocolo do procedimento.
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Triagem' }).click()
    await expect(page.getByText('Protocolo salvo · v1')).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
