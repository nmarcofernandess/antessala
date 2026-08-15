import { expect, test, type Page } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

/**
 * A vertical inteira, em base vazia, dentro do aplicativo.
 *
 * Cadastrar → abrir caso → timeline → assumir → entrevista → **reiniciar o
 * aplicativo e recuperar o rascunho** → finalizar → confirmar requisito →
 * reservar consulta → ver no calendário → conferir a história completa.
 *
 * O reinício no meio não é capricho: é o que separa "a tela guardou" de "o
 * banco guardou". Se o rascunho não sobreviver, a promessa de retomada é falsa.
 */
test.setTimeout(180_000)

async function preencherEncaminhamento(page: Page) {
  await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Novo encaminhamento' }).click()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/casos/novo')

  await page.getByLabel('Nome completo').fill('Aparecida Gomes Fontes')
  await page.getByLabel('Data de nascimento').fill('1954-03-21')

  await page.getByLabel('Sexo').click()
  await page.getByRole('option', { name: 'Feminino' }).click()

  await page.getByLabel('Procedimento').click()
  await page.getByRole('option', { name: 'Facectomia com implante' }).click()

  await page.getByLabel('Lateralidade').click()
  await page.getByRole('option', { name: 'Direita' }).click()

  await page.getByLabel('Serviço solicitante').click()
  await page.getByRole('option', { name: 'Oftalmologia' }).click()

  await page.getByLabel('Profissional solicitante').fill('Dra. Helena Castro · CRM-SP 118432')
}

/**
 * Responde toda a composição do protocolo — bloco a bloco, por tipo.
 *
 * Nada de heurística de clicar em tudo: cada widget tem um jeito próprio de
 * registrar resposta, e o teste só prova a jornada se souber respondê-los como
 * a enfermagem responderia. "Não" é resposta; branco não é.
 */
async function abrir(page: Page, tipo: string) {
  const cartao = page.locator(`[data-testid="bloco-anamnese"][data-tipo="${tipo}"]`)
  await expect(cartao).toHaveCount(1)
  const aberto = await cartao.locator('.border-t').count()
  if (aberto === 0) await cartao.locator('button').first().click()
  return cartao
}

async function responderEntrevista(page: Page) {
  // procedure_context já nasce transcrito do encaminhamento — nada a responder.

  for (const tipo of ['allergies', 'medications', 'diagnoses']) {
    const cartao = await abrir(page, tipo)
    await cartao.getByRole('button', { name: 'Não', exact: true }).first().click()
  }

  const vitais = await abrir(page, 'vital_signs')
  for (const [i, valor] of ['128', '78', '72', '97', '68', '162'].entries()) {
    await vitais.locator('input[type="number"]').nth(i).fill(valor)
  }

  const acomodacao = await abrir(page, 'accommodations')
  const naos = acomodacao.getByRole('button', { name: 'Não', exact: true })
  await expect(naos).toHaveCount(3)
  for (let i = 0; i < 3; i++) await naos.nth(i).click()

  const acompanhante = await abrir(page, 'escort_and_transport')
  await acompanhante.getByRole('button', { name: 'Não', exact: true }).first().click()
  await acompanhante.getByRole('button', { name: /Sozinho/ }).click()

  const exames = await abrir(page, 'exams_pending')
  await exames.getByLabel('Exame conferido').fill('Hemograma')
  await exames.getByRole('button', { name: 'Adicionar exame' }).click()
  await expect(exames.getByText('Hemograma')).toBeVisible()
  await exames.getByRole('button', { name: 'Em mãos' }).click()

  const notas = await abrir(page, 'clinical_notes')
  await notas.locator('textarea').fill('Paciente orientada sobre o dia da consulta.')
}

test('o caso caminha do encaminhamento à consulta marcada e a história registra tudo', async () => {
  let { app, page, dbPath } = await launchApp('caso-vertical')
  let caseHash = ''

  try {
    /* 1. painel vazio anuncia que está vazio */
    await expect(page.getByText('Nenhum encaminhamento registrado')).toBeVisible()

    /* 2. cadastrar encaminhamento e abrir o caso */
    await preencherEncaminhamento(page)
    await page.getByRole('button', { name: 'Abrir caso' }).click()

    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 15_000 })
      .toMatch(/#\/casos\/[0-9a-f-]{36}$/)
    caseHash = await page.evaluate(() => window.location.hash)

    /* 3. snapshots e timeline de abertura */
    await expect(page.getByRole('heading', { name: 'Aparecida Gomes Fontes' })).toBeVisible()
    await expect(page.getByText(/^ANT-\d{4}-\d{4}$/).first()).toBeVisible()
    const timeline = page.getByTestId('timeline')
    await expect(timeline.getByText('Caso aberto')).toBeVisible()
    await expect(timeline.getByText('Encaminhado à enfermagem')).toBeVisible()
    await expect(page.getByText(/Facectomia com implante/).first()).toBeVisible()

    /* 4. enfermagem assume o handoff */
    await page.getByTestId('assumir-caso').click()
    await expect(timeline.getByText('Enfermagem assumiu o caso')).toBeVisible()

    /* 5. entrevista pelos widgets do protocolo */
    await page.getByRole('link', { name: /entrevista/i }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/\/anamnese$/)
    await expect(page.getByText(/protocolo facectomia/)).toBeVisible()
    await responderEntrevista(page)
    await expect(page.getByTestId('estado-do-rascunho')).toContainText(/Rascunho salvo/, {
      timeout: 15_000,
    })

    /* 6. reiniciar o aplicativo e recuperar o rascunho */
    await app.close()
    ;({ app, page } = await launchApp('caso-vertical-restart', dbPath))
    await page.evaluate((h) => {
      window.location.hash = h
    }, `${caseHash}/anamnese`)
    await expect(page.getByText(/protocolo facectomia/)).toBeVisible({ timeout: 20_000 })
    // O que foi respondido antes do reinício continua respondido.
    await expect(page.getByTestId('finalizar-entrevista')).toBeEnabled({ timeout: 20_000 })

    /* 7. finalizar a entrevista */
    await page.getByTestId('finalizar-entrevista').click()
    await expect(page.getByTestId('painel-requisito')).toBeVisible({ timeout: 20_000 })

    /* 8. confirmar o requisito */
    await page.getByTestId('confirmar-requisito').click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(caseHash)
    await expect(page.getByTestId('requisito-do-caso')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('timeline').getByText('Requisito confirmado')).toBeVisible()

    /* 9. reservar a consulta pré-anestésica */
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    const fila = page.getByTestId('fila-para-agendar')
    await expect(fila.getByText('Aparecida Gomes Fontes')).toBeVisible({ timeout: 20_000 })
    await fila.getByTestId('marcar-consulta').first().click()

    // O modal abre já com os próximos horários que servem — não com um calendário.
    const modal = page.getByTestId('modal-agendar')
    await expect(modal).toBeVisible()
    await modal.getByTestId('vaga-sugerida').first().click()

    /* 10. a reserva aparece na agenda e abre o caso */
    await expect(fila.getByText('Aparecida Gomes Fontes')).toHaveCount(0, { timeout: 20_000 })
    const marcada = page.getByTestId('celula-agenda').filter({ hasText: '✓' }).first()
    await expect(marcada).toBeVisible({ timeout: 20_000 })
    await marcada.click()

    const dia = page.getByTestId('dia-empilhado')
    await expect(dia.getByText('Aparecida Gomes Fontes')).toBeVisible({ timeout: 20_000 })
    await dia.getByRole('button', { name: 'Aparecida Gomes Fontes' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(caseHash)

    /* 11. a história do caso está inteira */
    await page.evaluate((h) => {
      window.location.hash = h
    }, caseHash)
    const historia = page.getByTestId('timeline')
    for (const evento of [
      'Caso aberto',
      'Encaminhado à enfermagem',
      'Enfermagem assumiu o caso',
      'Entrevista iniciada',
      'Entrevista finalizada',
      'Requisito calculado',
      'Requisito confirmado',
      'Consulta reservada',
    ]) {
      await expect(historia.getByText(evento, { exact: true })).toBeVisible({ timeout: 20_000 })
    }

    /* o painel do dia deixou de estar vazio, e conta o que existe */
    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Início' }).click()
    const filaDoDia = page.getByTestId('fila-do-dia')
    await expect(filaDoDia.getByText('Aparecida Gomes Fontes')).toBeVisible({ timeout: 20_000 })
    await expect(filaDoDia.getByText('Nenhum encaminhamento registrado')).toHaveCount(0)
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
