import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

/**
 * A disponibilidade declarada uma vez, e a agenda inteira obedecendo.
 *
 * Esticar a barra da segunda-feira até as 20h é dizer como o consultório
 * funciona — não abrir vaga de uma semana. As vagas nascem disso, para todas as
 * segundas adiante, e sobrevivem ao reinício.
 */
test.setTimeout(180_000)

test('a disponibilidade é a regra, e as vagas nascem dela', async () => {
  let { app, page, dbPath } = await launchApp('disponibilidade')

  try {
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    await expect(page.getByTestId('grade-semanal')).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('abrir-disponibilidade').click()
    const modal = page.getByTestId('modal-disponibilidade')
    await expect(modal).toBeVisible({ timeout: 20_000 })
    await expect(modal.getByTestId('aba-consultorio')).toHaveCount(3)

    // Domingo nasce fechado; segunda a sexta, das 8h às 17h com pausa.
    const linhas = modal.getByTestId('linha-dia')
    await expect(linhas.nth(0)).toContainText('fechado')
    await expect(linhas.nth(1)).toContainText('08:00–17:00')
    await expect(linhas.nth(1).getByTestId('barra-pausa')).toHaveCount(1)

    /* esticar a segunda até as 20h, arrastando a ponta da barra */
    const handle = await linhas.nth(1).getByTestId('handle-fim').boundingBox()
    const trilho = await linhas.nth(1).locator('div.relative').boundingBox()
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
    await page.mouse.down()
    await page.mouse.move(trilho!.x + trilho!.width * 0.87, handle!.y + handle!.height / 2, {
      steps: 10,
    })
    await page.mouse.up()
    await expect(linhas.nth(1)).toContainText('20:00')

    /* sábado passa a abrir */
    await linhas.nth(6).getByRole('switch').click()
    await expect(linhas.nth(6)).not.toContainText('fechado')

    await page.getByTestId('salvar-disponibilidade').click()
    await expect(page.getByText(/vagas abertas/)).toBeVisible({ timeout: 20_000 })
    await page.keyboard.press('Escape')

    /* na próxima semana — a inteira, ainda no futuro — segunda e sábado abrem */
    await page.getByRole('button', { name: 'Hoje' }).locator('xpath=following-sibling::button').click()
    const celulas = page.getByTestId('celula-agenda')
    await expect(celulas.nth(1 * 7 + 1)).not.toHaveText('—', { timeout: 20_000 })
    await expect(celulas.nth(1 * 7 + 6)).not.toHaveText('—')
    // 19h de segunda existe agora; 19h de terça continua fora do expediente.
    await expect(celulas.nth(12 * 7 + 1)).not.toHaveText('—')
    await expect(celulas.nth(12 * 7 + 2)).toHaveText('—')

    /* reinício: a regra é do banco */
    await app.close()
    ;({ app, page } = await launchApp('disponibilidade-restart', dbPath))
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    await page.getByTestId('abrir-disponibilidade').click()
    await expect(page.getByTestId('linha-dia').nth(1)).toContainText('20:00', { timeout: 20_000 })
    await page.keyboard.press('Escape')

    /* um caso que não vai acontecer some da fila e vai para o arquivo */
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Novo encaminhamento' }).click()
    await page.getByLabel('Nome completo').fill('Teodoro Vilela Machado')
    await page.getByLabel('Data de nascimento').fill('1966-05-30')
    await page.getByLabel('Sexo').click()
    await page.getByRole('option', { name: 'Masculino' }).click()
    await page.getByLabel('Procedimento').click()
    await page.getByRole('option', { name: 'Facectomia com implante' }).click()
    await page.getByLabel('Serviço solicitante').click()
    await page.getByRole('option', { name: 'Oftalmologia' }).click()
    await page.getByLabel('Profissional solicitante').fill('Dr. Nelson Aguiar')
    await page.getByRole('button', { name: 'Abrir caso' }).click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 15_000 })
      .toMatch(/#\/casos\/[0-9a-f-]{36}$/)

    await page.getByTestId('cancelar-caso').click()
    await page
      .getByLabel('Motivo do cancelamento')
      .fill('Encaminhamento duplicado: já existe caso aberto para esta cirurgia.')
    await page.getByTestId('confirmar-cancelamento').click()
    await expect(page.getByTestId('status-do-caso')).toHaveText('Cancelado', { timeout: 20_000 })

    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Arquivados' }).click()
    await expect(
      page.getByTestId('arquivados').getByText('Teodoro Vilela Machado'),
    ).toBeVisible({ timeout: 20_000 })
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
