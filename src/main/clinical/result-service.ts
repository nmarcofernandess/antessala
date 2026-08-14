import { createHash, randomUUID } from 'node:crypto'
import { execute, queryAll, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento } from './case-service'
import { contarBloqueios, listarPendencias, obterEncontro } from './assessment-service'
import { ErroDeCaso, type ActorSnapshot, type CaseStatus } from '../../shared/clinical/caso'
import type {
  AvaliacaoCompletaV1,
  AvaliacaoRascunhoV1,
  DeliveryDTO,
  EmissionType,
  Narrativa,
  ResultDTO,
  ResultadoConteudoV1,
  ResultadoDoCasoDTO,
} from '../../shared/clinical/avaliacao'

/**
 * Resultado versionado e entrega.
 *
 * Uma versão finalizada nunca é reescrita — o trigger no banco recusa `UPDATE` e
 * `DELETE`. Corrigir um erro factual ou acrescentar informação cria a próxima
 * versão, apontando para a anterior, com motivo e autoria. O passado fica
 * porque foi ele que fundamentou o que já saiu daqui.
 *
 * A entrega é `LOCAL_DEMO` e o nome é literal: a versão selada fica disponível
 * ao serviço solicitante **dentro deste aplicativo**. Não existe canal externo,
 * e o produto não chama isso de envio ao hospital.
 *
 * O que o resultado não faz: atribuir ASA, declarar aptidão anestésica e marcar
 * cirurgia. Ele comunica o que foi avaliado, o que ficou em aberto e o que o
 * anestesiologista concluiu — a decisão cirúrgica continua fora.
 */

/* ══════════════ conteúdo ══════════════ */

function exigirTexto(valor: string, campo: string, min: number, max: number): string {
  const limpo = valor?.trim() ?? ''
  if (limpo.length < min || limpo.length > max) {
    throw new ErroDeCaso('VALIDATION_ERROR', `${campo} precisa ter entre ${min} e ${max} caracteres.`)
  }
  return limpo
}

function lista(valores: string[], campo: string): string[] {
  if (valores.length > 20) {
    throw new ErroDeCaso('VALIDATION_ERROR', `${campo} aceita até 20 itens.`)
  }
  return valores.map((v) => exigirTexto(v, campo, 1, 500))
}

function validarConteudo(c: ResultadoConteudoV1): ResultadoConteudoV1 {
  if (c?._v !== 1) throw new ErroDeCaso('VALIDATION_ERROR', 'Resultado em formato desconhecido.')
  return {
    _v: 1,
    resumoDaAvaliacao: exigirTexto(c.resumoDaAvaliacao, 'O resumo da avaliação', 10, 4000),
    conclusao: exigirTexto(c.conclusao, 'A conclusão', 10, 4000),
    recomendacoes: lista(c.recomendacoes ?? [], 'Cada recomendação'),
    limitacoes: lista(c.limitacoes ?? [], 'Cada limitação'),
    orientacoesDeRetorno: c.orientacoesDeRetorno?.trim()
      ? exigirTexto(c.orientacoesDeRetorno, 'As orientações de retorno', 1, 1000)
      : null,
  }
}

function hashDoConteudo(c: ResultadoConteudoV1): string {
  return createHash('sha256').update(JSON.stringify(c)).digest('hex')
}

/**
 * Converte o rascunho no conteúdo completo, ou recusa dizendo o que falta.
 *
 * Este é o único lugar que exige completude. O rascunho salva pela metade de
 * propósito: quem está entrevistando não escreve em ordem. Publicar é que pede
 * confirmação de pessoa e procedimento, nenhuma narrativa em branco e síntese
 * escrita — o mínimo para que a versão explique a si mesma daqui a um ano.
 */
function completar(rascunho: AvaliacaoRascunhoV1): AvaliacaoCompletaV1 {
  const faltando: string[] = []
  if (rascunho.confirmacao.pessoaConfere === null) faltando.push('confirmação da pessoa')
  if (rascunho.confirmacao.procedimentoConfere === null) {
    faltando.push('confirmação do procedimento')
  }

  const rotulos: Record<string, string> = {
    historiaIntervalo: 'história do intervalo',
    sintomasAtuais: 'sintomas atuais',
    geral: 'exame geral',
    viaAerea: 'via aérea',
    revisaoSinaisVitais: 'revisão dos sinais vitais',
    achadosAdicionais: 'achados adicionais',
  }
  const campos = { ...rascunho.entrevista, ...rascunho.exame }
  for (const [chave, narrativa] of Object.entries(campos)) {
    if (narrativa.estado === 'NOT_RECORDED') faltando.push(rotulos[chave] ?? chave)
  }
  if (!rascunho.sintese.resumo?.trim()) faltando.push('síntese da avaliação')

  if (faltando.length > 0) {
    throw new ErroDeCaso(
      'VALIDATION_ERROR',
      `A avaliação ainda não está completa: falta ${faltando.join(', ')}.`,
    )
  }

  return {
    _v: 1,
    state: 'COMPLETE',
    confirmacao: {
      pessoaConfere: rascunho.confirmacao.pessoaConfere as boolean,
      procedimentoConfere: rascunho.confirmacao.procedimentoConfere as boolean,
      nota: rascunho.confirmacao.nota,
    },
    entrevista: {
      historiaIntervalo: rascunho.entrevista.historiaIntervalo as Narrativa,
      sintomasAtuais: rascunho.entrevista.sintomasAtuais as Narrativa,
    },
    exame: {
      geral: rascunho.exame.geral as Narrativa,
      viaAerea: rascunho.exame.viaAerea as Narrativa,
      revisaoSinaisVitais: rascunho.exame.revisaoSinaisVitais as Narrativa,
      achadosAdicionais: rascunho.exame.achadosAdicionais as Narrativa,
    },
    documentosRevisados: rascunho.documentosRevisados,
    sintese: {
      resumo: rascunho.sintese.resumo as string,
      limitacoes: rascunho.sintese.limitacoes,
    },
  }
}

/* ══════════════ leitura ══════════════ */

type LinhaResultado = {
  id: string
  case_id: string
  encounter_id: string
  version_number: number
  emission_type: EmissionType
  predecessor_result_id: string | null
  reason: string | null
  content: ResultadoConteudoV1
  finalized_by_snapshot: ActorSnapshot
  finalized_at: string
  content_hash: string
}

function doResultado(l: LinhaResultado, correnteId: string | null): ResultDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    encounterId: l.encounter_id,
    versionNumber: l.version_number,
    emissionType: l.emission_type,
    predecessorResultId: l.predecessor_result_id,
    reason: l.reason,
    isCurrent: l.id === correnteId,
    content: l.content,
    contentHash: l.content_hash,
    finalizedBy: l.finalized_by_snapshot,
    finalizedAt: l.finalized_at,
  }
}

type LinhaEntrega = {
  id: string
  case_id: string
  result_id: string
  target_service_id: string
  service_name: string
  channel: 'LOCAL_DEMO'
  status: 'SENT' | 'RECEIVED'
  result_hash: string
  sent_by_snapshot: ActorSnapshot
  sent_at: string
  received_by_snapshot: ActorSnapshot | null
  received_at: string | null
  version: number
}

function daEntrega(l: LinhaEntrega): DeliveryDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    resultId: l.result_id,
    targetServiceId: l.target_service_id,
    serviceName: l.service_name,
    channel: l.channel,
    status: l.status,
    resultHash: l.result_hash,
    sentBy: l.sent_by_snapshot,
    sentAt: l.sent_at,
    receivedBy: l.received_by_snapshot,
    receivedAt: l.received_at,
    version: l.version,
  }
}

const SELECT_ENTREGA = `
  SELECT d.*, s.nome AS service_name
    FROM result_deliveries d
    JOIN catalogo_servicos_solicitantes s ON s.id = d.target_service_id
`

/** Tudo que a tela do caso precisa saber sobre avaliação, resultado e entrega. */
export async function obterResultadoDoCaso(caseId: string): Promise<ResultadoDoCasoDTO> {
  const encontro = await obterEncontro(caseId)
  const pendencias = await listarPendencias(caseId)

  const head = await queryOne<{ current_result_id: string }>(
    `SELECT current_result_id FROM preop_result_heads WHERE case_id = $1`,
    caseId,
  )
  const linhas = await queryAll<LinhaResultado>(
    `SELECT * FROM preop_results WHERE case_id = $1 ORDER BY version_number DESC`,
    caseId,
  )
  const versoes = linhas.map((l) => doResultado(l, head?.current_result_id ?? null))

  const entrega = await queryOne<LinhaEntrega>(
    `${SELECT_ENTREGA} WHERE d.case_id = $1 ORDER BY d.sent_at DESC LIMIT 1`,
    caseId,
  )

  return {
    encounter: encontro,
    pendencies: pendencias,
    blockers: encontro ? await contarBloqueios(encontro.id, encontro.reviewCycle) : 0,
    current: versoes.find((v) => v.isCurrent) ?? null,
    history: versoes,
    delivery: entrega ? daEntrega(entrega) : null,
  }
}

/* ══════════════ emitir ══════════════ */

export async function finalizarResultado(entrada: {
  encounterId: string
  expectedEncounterVersion: number
  content: ResultadoConteudoV1
  idempotencyKey: string
}): Promise<ResultDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')
  const conteudo = validarConteudo(entrada.content)
  const hash = hashDoConteudo(conteudo)

  const recibo = await queryOne<{ result_json: { resultId: string } }>(
    `SELECT result_json FROM assessment_command_receipts WHERE idempotency_key = $1`,
    entrada.idempotencyKey,
  )
  if (recibo) {
    const existente = await queryOne<LinhaResultado>(
      `SELECT * FROM preop_results WHERE id = $1`,
      recibo.result_json.resultId,
    )
    if (existente) return doResultado(existente, existente.id)
  }

  const resultId = randomUUID()

  await transaction(async () => {
    const encontro = await queryOne<{
      id: string
      case_id: string
      status: string
      review_cycle: number
      version: number
      assessment_content: AvaliacaoRascunhoV1
    }>(`SELECT * FROM anesthesia_encounters WHERE id = $1 FOR UPDATE`, entrada.encounterId)
    if (!encontro) throw new ErroDeCaso('NOT_FOUND', 'Encontro não encontrado.')
    if (encontro.version !== entrada.expectedEncounterVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A avaliação mudou em outra janela.')
    }
    if (encontro.status !== 'IN_PROGRESS') {
      throw new ErroDeCaso(
        'INVALID_TRANSITION',
        'Só um encontro em andamento emite resultado. Retome a avaliação primeiro.',
      )
    }

    const bloqueios = await contarBloqueios(encontro.id, encontro.review_cycle)
    if (bloqueios > 0) {
      throw new ErroDeCaso(
        'OPEN_BLOCKERS',
        `Ainda há ${bloqueios} pendência(s) marcada(s) como impeditiva(s) do resultado.`,
      )
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      encontro.case_id,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    // Publicar congela a avaliação como conteúdo completo — o rascunho deixa
    // de ser rascunho no mesmo commit que cria a versão.
    const completa = completar(encontro.assessment_content)

    await execute(
      `INSERT INTO preop_results (
         id, case_id, encounter_id, version_number, emission_type, content,
         finalized_by_snapshot, finalized_at, content_hash
       ) VALUES ($1,$2,$3,1,'FINAL',$4::jsonb,$5::jsonb,NOW(),$6)`,
      resultId,
      encontro.case_id,
      encontro.id,
      JSON.stringify(conteudo),
      JSON.stringify(anestesista),
      hash,
    )

    await execute(
      `INSERT INTO preop_result_heads (case_id, current_result_id, current_version_number, updated_at)
       VALUES ($1,$2,1,NOW())`,
      encontro.case_id,
      resultId,
    )

    await execute(
      `UPDATE anesthesia_encounters
          SET assessment_content = $2::jsonb, status = 'COMPLETED',
              completion_reason = 'RESULT_FINALIZED', completed_at = NOW(),
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      encontro.id,
      JSON.stringify(completa),
    )

    await execute(
      `UPDATE preop_cases SET status = 'READY_FOR_HANDOFF', version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      encontro.case_id,
    )

    await execute(
      `INSERT INTO assessment_command_receipts (idempotency_key, command, case_id, input_fingerprint, result_json)
       VALUES ($1,'FINALIZE_RESULT',$2,$3,$4::jsonb)`,
      entrada.idempotencyKey,
      encontro.case_id,
      hash,
      JSON.stringify({ resultId }),
    )

    await registrarEvento({
      caseId: encontro.case_id,
      eventType: 'RESULT_FINALIZED',
      fromStatus: caso.status,
      toStatus: 'READY_FOR_HANDOFF',
      actor: anestesista,
      payload: { resultId, versionNumber: 1, contentHash: hash },
      receiptDomain: 'ASSESSMENT',
      receiptId: entrada.idempotencyKey,
      commandEventIndex: 1,
    })
  })

  const criado = await queryOne<LinhaResultado>(`SELECT * FROM preop_results WHERE id = $1`, resultId)
  return doResultado(criado!, resultId)
}

/**
 * Corrige ou adita o resultado corrente.
 *
 * Nasce como versão nova e imutável, apontando para a anterior. Se a versão
 * corrigida já tinha sido disponibilizada, o caso volta para entrega: quem
 * recebeu a versão errada precisa receber a certa, e o recibo antigo continua
 * lá para explicar o que estava valendo naquele momento.
 */
export async function revisarResultado(entrada: {
  caseId: string
  expectedHeadVersion: number
  predecessorResultId: string
  emissionType: 'CORRECTION' | 'ADDENDUM'
  reason: string
  content: ResultadoConteudoV1
}): Promise<ResultDTO> {
  await garantirContaSintetica()
  const anestesista = ator('ANESTESIOLOGISTA')
  const conteudo = validarConteudo(entrada.content)
  const motivo = exigirTexto(entrada.reason, 'O motivo da revisão', 10, 1000)
  const hash = hashDoConteudo(conteudo)
  const resultId = randomUUID()

  await transaction(async () => {
    const head = await queryOne<{
      current_result_id: string
      current_version_number: number
      version: number
    }>(`SELECT * FROM preop_result_heads WHERE case_id = $1 FOR UPDATE`, entrada.caseId)
    if (!head) throw new ErroDeCaso('NOT_FOUND', 'Este caso ainda não tem resultado emitido.')
    if (head.version !== entrada.expectedHeadVersion) {
      throw new ErroDeCaso('RESULT_VERSION_CONFLICT', 'O resultado mudou em outra janela.')
    }
    if (head.current_result_id !== entrada.predecessorResultId) {
      throw new ErroDeCaso(
        'RESULT_VERSION_CONFLICT',
        'A versão que você está corrigindo não é mais a corrente.',
      )
    }

    const anterior = await queryOne<{ encounter_id: string }>(
      `SELECT encounter_id FROM preop_results WHERE id = $1`,
      entrada.predecessorResultId,
    )

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrada.caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    await execute(
      `INSERT INTO preop_results (
         id, case_id, encounter_id, version_number, emission_type, predecessor_result_id,
         reason, content, finalized_by_snapshot, finalized_at, content_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,NOW(),$10)`,
      resultId,
      entrada.caseId,
      anterior!.encounter_id,
      head.current_version_number + 1,
      entrada.emissionType,
      entrada.predecessorResultId,
      motivo,
      JSON.stringify(conteudo),
      JSON.stringify(anestesista),
      hash,
    )

    await execute(
      `UPDATE preop_result_heads
          SET current_result_id = $2, current_version_number = $3,
              version = version + 1, updated_at = NOW()
        WHERE case_id = $1`,
      entrada.caseId,
      resultId,
      head.current_version_number + 1,
    )

    // Corrigir depois de entregue exige entregar de novo. A entrega anterior
    // continua registrada: ela é a prova do que o serviço leu antes.
    const entregue = await queryOne<{ id: string }>(
      `SELECT id FROM result_deliveries WHERE case_id = $1`,
      entrada.caseId,
    )
    const proximoStatus: CaseStatus = entregue ? 'READY_FOR_HANDOFF' : caso.status

    if (caso.status !== proximoStatus) {
      await execute(
        `UPDATE preop_cases SET status = $2, version = version + 1, updated_at = NOW() WHERE id = $1`,
        entrada.caseId,
        proximoStatus,
      )
    } else {
      await execute(
        `UPDATE preop_cases SET version = version + 1, updated_at = NOW() WHERE id = $1`,
        entrada.caseId,
      )
    }

    await registrarEvento({
      caseId: entrada.caseId,
      eventType: 'RESULT_REVISED',
      fromStatus: caso.status,
      toStatus: proximoStatus,
      actor: anestesista,
      reason: motivo,
      payload: {
        resultId,
        versionNumber: head.current_version_number + 1,
        emissionType: entrada.emissionType,
        predecessorResultId: entrada.predecessorResultId,
        contentHash: hash,
      },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${resultId}:revise`,
      commandEventIndex: 1,
    })
  })

  const criado = await queryOne<LinhaResultado>(`SELECT * FROM preop_results WHERE id = $1`, resultId)
  return doResultado(criado!, resultId)
}

/* ══════════════ entrega ══════════════ */

/**
 * Disponibiliza a versão corrente ao serviço solicitante, dentro do app.
 *
 * O destinatário vem do caso — o renderer não escolhe para quem vai. O caso
 * **não** muda de estado aqui: disponibilizar não é ser recebido, e fingir o
 * contrário encerraria o caso antes de alguém do outro lado abrir a tela.
 */
export async function enviarEntrega(entrada: {
  caseId: string
  idempotencyKey: string
}): Promise<DeliveryDTO> {
  await garantirContaSintetica()
  const atorRecepcao = ator('RECEPCAO')
  const deliveryId = randomUUID()

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus; requesting_service_id: string }>(
      `SELECT status, requesting_service_id FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrada.caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')
    if (caso.status !== 'READY_FOR_HANDOFF') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Este caso não tem resultado pronto para entrega.')
    }

    const head = await queryOne<{ current_result_id: string }>(
      `SELECT current_result_id FROM preop_result_heads WHERE case_id = $1`,
      entrada.caseId,
    )
    if (!head) throw new ErroDeCaso('NOT_FOUND', 'Não há resultado corrente para entregar.')

    const resultado = await queryOne<{ id: string; content_hash: string }>(
      `SELECT id, content_hash FROM preop_results WHERE id = $1`,
      head.current_result_id,
    )

    const jaEntregue = await queryOne<{ id: string }>(
      `SELECT id FROM result_deliveries WHERE result_id = $1`,
      resultado!.id,
    )
    if (jaEntregue) {
      throw new ErroDeCaso('DUPLICATE_REQUEST', 'Esta versão já foi disponibilizada ao solicitante.')
    }

    await execute(
      `INSERT INTO result_deliveries (
         id, case_id, result_id, target_service_id, channel, status, result_hash,
         sent_by_snapshot, sent_at
       ) VALUES ($1,$2,$3,$4,'LOCAL_DEMO','SENT',$5,$6::jsonb,NOW())`,
      deliveryId,
      entrada.caseId,
      resultado!.id,
      caso.requesting_service_id,
      resultado!.content_hash,
      JSON.stringify(atorRecepcao),
    )

    await execute(
      `INSERT INTO assessment_command_receipts (idempotency_key, command, case_id, input_fingerprint, result_json)
       VALUES ($1,'SEND_DELIVERY',$2,$3,$4::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      entrada.idempotencyKey,
      entrada.caseId,
      resultado!.id,
      JSON.stringify({ deliveryId }),
    )

    await registrarEvento({
      caseId: entrada.caseId,
      eventType: 'DELIVERY_SENT',
      fromStatus: 'READY_FOR_HANDOFF',
      toStatus: 'READY_FOR_HANDOFF',
      actor: atorRecepcao,
      payload: {
        deliveryId,
        resultId: resultado!.id,
        channel: 'LOCAL_DEMO',
        targetServiceId: caso.requesting_service_id,
      },
      receiptDomain: 'ASSESSMENT',
      receiptId: entrada.idempotencyKey,
      commandEventIndex: 1,
    })
  })

  const criada = await queryOne<LinhaEntrega>(`${SELECT_ENTREGA} WHERE d.id = $1`, deliveryId)
  return daEntrega(criada!)
}

/**
 * O serviço solicitante confirma que recebeu aquela versão.
 *
 * É aqui — e só aqui — que o caso termina. Confirmar recebimento de uma versão
 * que deixou de ser a corrente é recusado: o que precisa chegar é a versão que
 * está valendo.
 */
export async function confirmarRecebimento(entrada: {
  deliveryId: string
  expectedVersion: number
}): Promise<DeliveryDTO> {
  await garantirContaSintetica()
  const solicitante = ator('SOLICITANTE')

  await transaction(async () => {
    const entrega = await queryOne<LinhaEntrega>(
      `SELECT * FROM result_deliveries WHERE id = $1 FOR UPDATE`,
      entrada.deliveryId,
    )
    if (!entrega) throw new ErroDeCaso('NOT_FOUND', 'Entrega não encontrada.')
    if (entrega.version !== entrada.expectedVersion) {
      throw new ErroDeCaso('VERSION_CONFLICT', 'A entrega mudou em outra janela.')
    }
    if (entrega.status !== 'SENT') {
      throw new ErroDeCaso('INVALID_TRANSITION', 'Esta entrega já foi confirmada.')
    }

    const head = await queryOne<{ current_result_id: string }>(
      `SELECT current_result_id FROM preop_result_heads WHERE case_id = $1`,
      entrega.case_id,
    )
    if (head?.current_result_id !== entrega.result_id) {
      throw new ErroDeCaso(
        'RESULT_VERSION_CONFLICT',
        'Existe uma versão mais nova do resultado. Confirme o recebimento dela.',
      )
    }

    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      entrega.case_id,
    )

    await execute(
      `UPDATE result_deliveries
          SET status = 'RECEIVED', received_by_snapshot = $2::jsonb, received_at = NOW(),
              version = version + 1
        WHERE id = $1`,
      entrada.deliveryId,
      JSON.stringify(solicitante),
    )

    // Estado terminal fecha o caso: `closed_at` é o que o banco exige para
    // aceitar que essa história acabou.
    await execute(
      `UPDATE preop_cases
          SET status = 'DELIVERED_TO_REQUESTER', closed_at = NOW(),
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      entrega.case_id,
    )

    await registrarEvento({
      caseId: entrega.case_id,
      eventType: 'DELIVERY_ACKNOWLEDGED',
      fromStatus: caso?.status ?? 'READY_FOR_HANDOFF',
      toStatus: 'DELIVERED_TO_REQUESTER',
      actor: solicitante,
      payload: { deliveryId: entrada.deliveryId, resultId: entrega.result_id },
      receiptDomain: 'ASSESSMENT',
      receiptId: `${entrada.deliveryId}:ack`,
      commandEventIndex: 1,
    })
  })

  const atualizada = await queryOne<LinhaEntrega>(
    `${SELECT_ENTREGA} WHERE d.id = $1`,
    entrada.deliveryId,
  )
  return daEntrega(atualizada!)
}
