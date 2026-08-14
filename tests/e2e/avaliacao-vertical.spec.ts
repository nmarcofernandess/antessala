import { expect, test, type Page } from '@playwright/test'
import { launchApp, removeAppData } from './helpers'

/**
 * Da consulta marcada até o resultado entregue, dentro do aplicativo.
 *
 * chegada → avaliação → pendência impeditiva → resposta → aceite → retomada →
 * resultado → entrega → confirmação do solicitante → arquivados.
 *
 * O teste existe para provar as separações que a tela poderia mentir: entregar
 * a resposta não a torna aceita, pendência aberta não é caso travado, e
 * disponibilizar o resultado não é o mesmo que alguém ter recebido.
 */
test.setTimeout(240_000)

async function preencherEncaminhamento(page: Page) {
  await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Novo encaminhamento' }).click()
  await page.getByLabel('Nome completo').fill('Benedito Alves Portela')
  await page.getByLabel('Data de nascimento').fill('1949-11-02')
  await page.getByLabel('Sexo').click()
  await page.getByRole('option', { name: 'Masculino' }).click()
  await page.getByLabel('Procedimento').click()
  await page.getByRole('option', { name: 'Facectomia com implante' }).click()
  await page.getByLabel('Lateralidade').click()
  await page.getByRole('option', { name: 'Esquerda' }).click()
  await page.getByLabel('Serviço solicitante').click()
  await page.getByRole('option', { name: 'Oftalmologia' }).click()
  await page.getByLabel('Profissional solicitante').fill('Dr. Ivan Meireles · CRM-SP 90211')
  await page.getByRole('button', { name: 'Abrir caso' }).click()
}

/** Responde a composição do protocolo até a entrevista poder ser publicada. */
async function responderEntrevista(page: Page) {
  const cartao = (tipo: string) =>
    page.locator(`[data-testid="bloco-anamnese"][data-tipo="${tipo}"]`)

  async function abrir(tipo: string) {
    const c = cartao(tipo)
    if ((await c.locator('.border-t').count()) === 0) await c.locator('button').first().click()
    return c
  }

  for (const tipo of ['allergies', 'medications', 'diagnoses']) {
    const c = await abrir(tipo)
    await c.getByRole('button', { name: 'Não', exact: true }).first().click()
  }

  const vitais = await abrir('vital_signs')
  for (const [i, valor] of ['132', '84', '76', '96', '74', '170'].entries()) {
    await vitais.locator('input[type="number"]').nth(i).fill(valor)
  }

  const acomodacao = await abrir('accommodations')
  const naos = acomodacao.getByRole('button', { name: 'Não', exact: true })
  for (let i = 0; i < 3; i++) await naos.nth(i).click()

  const acompanhante = await abrir('escort_and_transport')
  await acompanhante.getByRole('button', { name: 'Não', exact: true }).first().click()
  await acompanhante.getByRole('button', { name: /Sozinho/ }).click()

  const exames = await abrir('exams_pending')
  await exames.getByLabel('Exame conferido').fill('Hemograma')
  await exames.getByRole('button', { name: 'Adicionar exame' }).click()
  await exames.getByRole('button', { name: 'Em mãos' }).click()

  const notas = await abrir('clinical_notes')
  await notas.locator('textarea').fill('Entrevista sem intercorrências.')
}

/** Escreve a avaliação inteira: cada narrativa escolhe um estado. */
async function preencherAvaliacao(page: Page) {
  await page.getByTestId('confirma-pessoa').click()
  await page.getByTestId('confirma-procedimento').click()

  const campos: [string, string][] = [
    ['História do intervalo', 'Sem mudança desde a entrevista da enfermagem.'],
    ['Sintomas atuais', 'Assintomático no momento da consulta.'],
    ['Exame geral', 'Bom estado geral, corado e hidratado.'],
    ['Via aérea', 'Abertura bucal e extensão cervical preservadas.'],
    ['Revisão dos sinais vitais', 'Sinais aferidos pela enfermagem conferidos nesta consulta.'],
    ['Achados adicionais', 'Nada a acrescentar.'],
  ]
  for (const [rotulo, texto] of campos) {
    await page.getByLabel(`Estado de ${rotulo}`).click()
    await page.getByRole('option', { name: 'Registrado' }).click()
    await page.getByLabel(rotulo, { exact: true }).fill(texto)
  }

  await page.getByLabel('Síntese da avaliação').fill('Avaliação concluída sem achados novos.')
}

test('o caso vai da chegada ao resultado entregue, e só termina quando alguém confirma', async () => {
  const { app, page, dbPath } = await launchApp('avaliacao-vertical')

  try {
    /* 1. caso novo levado até ter consulta marcada */
    await preencherEncaminhamento(page)
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 15_000 })
      .toMatch(/#\/casos\/[0-9a-f-]{36}$/)
    const caseHash = await page.evaluate(() => window.location.hash)

    await page.getByTestId('assumir-caso').click()
    await page.getByRole('link', { name: /entrevista/i }).click()
    await expect(page.getByText(/protocolo facectomia/)).toBeVisible({ timeout: 20_000 })
    await responderEntrevista(page)
    await expect(page.getByTestId('finalizar-entrevista')).toBeEnabled({ timeout: 20_000 })
    await page.getByTestId('finalizar-entrevista').click()
    await expect(page.getByTestId('painel-requisito')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('confirmar-requisito').click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(caseHash)

    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Agenda' }).click()
    await page.getByRole('tab', { name: /Para agendar/ }).click()
    await page
      .getByTestId('fila-para-agendar')
      .getByRole('button', { name: 'Escolher vaga' })
      .click()
    await page
      .getByRole('dialog')
      .locator('button')
      .filter({ hasText: /\d{2}:\d{2}/ })
      .first()
      .click()

    /* 2. a recepção registra a chegada — o relógio não faz isso sozinho */
    const lista = page.getByTestId('agenda-lista')
    await expect(lista.getByText('Benedito Alves Portela')).toBeVisible({ timeout: 20_000 })
    await lista.getByTestId('agenda-chegada').first().click()
    await expect(lista.getByText('Chegada registrada')).toBeVisible({ timeout: 20_000 })

    /* 3. o anestesista abre a avaliação */
    await page.evaluate((h) => {
      window.location.hash = h
    }, caseHash)
    await expect(page.getByTestId('status-do-caso')).toHaveText('Aguardando anestesista', {
      timeout: 20_000,
    })
    await page.getByTestId('iniciar-avaliacao').click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/\/avaliacao$/)
    await expect(page.getByTestId('avaliacao-editor')).toBeVisible()

    await preencherAvaliacao(page)
    await expect(page.getByTestId('estado-da-avaliacao')).toContainText(/Rascunho salvo/, {
      timeout: 20_000,
    })

    /* 4. uma pendência impeditiva trava a emissão */
    await page.getByTestId('abrir-pendencia').click()
    await page.getByLabel('Título do pedido').fill('Eletrocardiograma recente')
    await page
      .getByLabel('Descrição da pendência')
      .fill('Falta o traçado recente pedido pelo serviço solicitante.')
    await page.getByTestId('salvar-pendencia').click()

    await expect(page.getByTestId('pendencia-item')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/1 pendência\(s\) impeditiva\(s\)/)).toBeVisible()
    await expect(page.getByTestId('emitir-resultado')).toBeDisabled()

    /* 5. entregar a resposta não é a resposta ser aceita */
    await page.getByTestId('responder-pendencia').click()
    await page.getByLabel('Resposta da pendência').fill('Traçado entregue pelo acompanhante.')
    await page.getByTestId('enviar-resposta').click()
    const pendencia = page.getByTestId('pendencia-item')
    await expect(pendencia.getByText('Resposta entregue')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('emitir-resultado')).toBeDisabled()

    await page.getByLabel('Motivo da decisão').fill('O traçado responde ao que foi perguntado.')
    await page.getByTestId('aceitar-pendencia').click()
    await expect(pendencia.getByText('Aceita como suficiente')).toBeVisible({ timeout: 20_000 })

    /* 6. sem bloqueio vivo, a avaliação é retomada e o resultado sai */
    await page.getByTestId('retomar-avaliacao').click()
    await expect(page.getByText(/ciclo de revisão 2/)).toBeVisible({ timeout: 20_000 })

    await page.getByLabel('Resumo da avaliação').fill('Consulta pré-anestésica presencial.')
    await page
      .getByLabel('Conclusão', { exact: true })
      .fill('Avaliação concluída; achados e limitações registrados nesta versão.')
    await page.getByTestId('emitir-resultado').click()

    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(caseHash)
    const resultado = page.getByTestId('resultado-do-caso')
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    await expect(resultado.getByText(/Versão final · versão 1/)).toBeVisible()
    await expect(page.getByTestId('status-do-caso')).toHaveText('Pronto para entrega')

    /* 7. disponibilizar não encerra; confirmar encerra */
    await page.getByTestId('enviar-entrega').click()
    await expect(resultado.getByText(/Disponível para/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('status-do-caso')).toHaveText('Pronto para entrega')

    await page.getByTestId('confirmar-recebimento').click()
    await expect(resultado.getByText(/Recebido por/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('status-do-caso')).toHaveText('Entregue ao solicitante')

    /* 8. a história inteira, e o caso no arquivo */
    const historia = page.getByTestId('timeline')
    for (const evento of [
      'Chegada confirmada',
      'Avaliação iniciada',
      'Pendência aberta',
      'Resposta entregue à pendência',
      'Pendência aceita como suficiente',
      'Avaliação retomada',
      'Resultado emitido',
      'Resultado disponibilizado ao solicitante',
      'Solicitante confirmou o recebimento',
    ]) {
      await expect(historia.getByText(evento, { exact: true })).toBeVisible({ timeout: 20_000 })
    }

    await page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Arquivados' }).click()
    const arquivados = page.getByTestId('arquivados')
    await expect(arquivados.getByText('Benedito Alves Portela')).toBeVisible({ timeout: 20_000 })
    await expect(arquivados.getByText('Entregue ao solicitante')).toBeVisible()
  } finally {
    await app.close()
    removeAppData(dbPath)
  }
})
