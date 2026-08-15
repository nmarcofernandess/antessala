import { expect, test } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

/**
 * A oferta da agenda editada de dentro do aplicativo.
 *
 * Criar consultório, gerar vagas para ele e ver a oferta crescer — em base
 * vazia, com o banco de verdade, sobrevivendo ao reinício. Enquanto isso era
 * constante compilada, a demonstração dizia à operação como ela trabalha.
 */
test.setTimeout(180_000)

test('a operação cria consultório, gera vagas e a oferta muda de tamanho', async () => {
  let { app, page, dbPath } = await launchApp('capacidade-agenda')

  try {
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    await page.getByRole('tab', { name: /Capacidade/ }).click()

    const painel = page.getByTestId('capacidade')
    await expect(painel).toBeVisible({ timeout: 20_000 })

    // A fixture do primeiro boot: três consultórios com oferta já gerada.
    await expect(page.getByTestId('consultorio-item')).toHaveCount(3)
    const rapidasAntes = await painel
      .getByText('Vaga rápida')
      .locator('xpath=following-sibling::p')
      .first()
      .innerText()

    /* consultório novo */
    await page.getByTestId('novo-consultorio').click()
    await page.getByLabel('Nome do consultório').fill('Consultório da Ala Norte')
    await page.getByRole('button', { name: 'Sala acessível' }).click()
    await page.getByTestId('salvar-consultorio').click()

    await expect(page.getByTestId('consultorio-item')).toHaveCount(4)
    const novo = page
      .getByTestId('consultorio-item')
      .filter({ hasText: 'Consultório da Ala Norte' })
    await expect(novo).toBeVisible()
    await expect(novo.getByText('0 vagas futuras · 0 com consulta')).toBeVisible()

    /* gerar vagas só para ele */
    for (const nome of ['Consultório 1', 'Consultório 2', 'Consultório 3']) {
      await painel.getByRole('button', { name: nome, exact: true }).click()
    }
    await page.getByTestId('gerar-vagas').click()
    await expect(novo.getByText(/[1-9]\d* vagas futuras/)).toBeVisible({ timeout: 20_000 })

    const rapidasDepois = await painel
      .getByText('Vaga rápida')
      .locator('xpath=following-sibling::p')
      .first()
      .innerText()
    expect(Number.parseInt(rapidasDepois, 10)).toBeGreaterThan(Number.parseInt(rapidasAntes, 10))

    /* gerar de novo não duplica */
    await page.getByTestId('gerar-vagas').click()
    await expect(page.getByText(/já estava coberto|já existiam/)).toBeVisible({ timeout: 20_000 })

    /* a nova sala aparece no filtro do calendário e sobrevive ao reinício */
    await app.close()
    ;({ app, page } = await launchApp('capacidade-agenda-restart', dbPath))
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    await page.getByLabel('Filtrar por consultório').click()
    await expect(page.getByRole('option', { name: 'Consultório da Ala Norte' })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('option', { name: 'Consultório da Ala Norte' }).click()

    await page.getByRole('tab', { name: /Capacidade/ }).click()
    await expect(page.getByTestId('consultorio-item')).toHaveCount(4)

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
    await expect(page.getByTestId('timeline').getByText('Caso cancelado')).toBeVisible()

    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Arquivados' }).click()
    const arquivados = page.getByTestId('arquivados')
    await expect(arquivados.getByText('Teodoro Vilela Machado')).toBeVisible({ timeout: 20_000 })
    await expect(arquivados.getByText('Cancelado', { exact: true })).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
