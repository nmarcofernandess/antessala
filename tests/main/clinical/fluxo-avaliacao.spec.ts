import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, queryOne } from '../../../src/main/db/query'
import { garantirContaSintetica } from '../../../src/main/auth/session'
import { seedProtocolos } from '../../../src/main/db/protocolos'
import { semearCapacidade } from '../../../src/main/scheduling/capacity-seed'
import {
  criarCaso,
  aceitarHandoff,
  cancelarCaso,
  obterCaso,
} from '../../../src/main/clinical/case-service'
import {
  abrirAnamnese,
  finalizarAnamnese,
  salvarRascunho,
} from '../../../src/main/clinical/anamnesis-service'
import {
  calcularParaCaso,
  confirmarRequisito,
} from '../../../src/main/clinical/requirement-service'
import {
  registrarAusencia,
  registrarChegada,
  reservar,
  vagasCompativeis,
} from '../../../src/main/scheduling/agenda-service'
import {
  abrirPendencia,
  cancelarPendencia,
  iniciarEncontro,
  interromperEncontro,
  obterEncontro,
  retomarRevisao,
  revisarEvidencia,
  salvarAvaliacao,
  submeterEvidencia,
} from '../../../src/main/clinical/assessment-service'
import {
  confirmarRecebimento,
  enviarEntrega,
  finalizarResultado,
  obterResultadoDoCaso,
  revisarResultado,
} from '../../../src/main/clinical/result-service'
import { responder } from '../../../src/shared/clinical/anamnese-tipos'
import { ErroDeCaso, type AnamnesisBlock } from '../../../src/shared/clinical/caso'
import {
  rascunhoVazio,
  type AvaliacaoRascunhoV1,
  type ResultadoConteudoV1,
} from '../../../src/shared/clinical/avaliacao'

/**
 * Da chegada à entrega, contra o banco de verdade.
 *
 * O que estes testes protegem são as separações que o domínio proíbe fundir:
 * chegar não é ser avaliado, entregar resposta não é ter a resposta aceita,
 * pendência aberta não é caso travado, e disponibilizar não é ter sido recebido.
 *
 * E protegem a regra que nenhuma tela mostra: **o relógio não muda estado**.
 * Nada aqui vira no-show, conclui encontro ou entrega resultado porque o
 * horário passou — cada transição tem um comando, um ator e um motivo.
 */
describe('avaliação, pendências, resultado e entrega', () => {
  let dbDir: string

  async function servico(): Promise<string> {
    const s = await queryOne<{ id: string }>(
      `SELECT id FROM catalogo_servicos_solicitantes ORDER BY nome LIMIT 1`,
    )
    return s!.id
  }

  function responderTudo(blocos: AnamnesisBlock[]): AnamnesisBlock[] {
    return blocos.map((b) => {
      const d = { ...(b.dados as Record<string, unknown>) }
      for (const [chave, valor] of Object.entries(d)) {
        if (valor && typeof valor === 'object' && 'estado' in (valor as object)) {
          d[chave] = responder(false)
        }
      }
      if (b.tipo === 'procedure_context') d.indicacao = 'Catarata em olho direito'
      if (b.tipo === 'clinical_notes') d.nota = 'Sem intercorrências na entrevista.'
      if (b.tipo === 'exams_pending') {
        d.itens = [{ id: 'e1', nome: 'Hemograma', status: 'DISPONIVEL' }]
      }
      if (b.tipo === 'vital_signs') {
        for (const c of [
          'sistolica',
          'diastolica',
          'frequenciaCardiaca',
          'saturacao',
          'peso',
          'altura',
        ]) {
          d[c] = responder(100)
        }
      }
      if (b.tipo === 'functional_capacity') d.atividade = responder('Sobe um lance de escada')
      if (b.tipo === 'habits_substances') {
        d.tabaco = responder('NUNCA')
        d.alcool = responder('NUNCA')
      }
      if (b.tipo === 'escort_and_transport') d.formaRetorno = responder('ACOMPANHADO')
      return { ...b, dados: d }
    })
  }

  /** Caso levado até ter consulta marcada — o ponto de partida deste domínio. */
  async function casoAgendado() {
    const caso = await criarCaso({
      person: { fullName: 'Aparecida Gomes Fontes', birthDate: '1954-03-21', sexReported: 'FEMININO' },
      referral: { sourceReference: null, freeTextReference: 'Encaminhamento da oftalmologia' },
      procedure: { description: 'Facectomia com implante', lateralityOrSite: 'Direita', notes: null },
      requester: { serviceId: await servico(), physicianName: 'Dra. Helena Castro' },
      idempotencyKey: randomUUID(),
    })

    const assumido = await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    void assumido

    const anam = await abrirAnamnese(caso.id)
    const salvo = await salvarRascunho({
      anamnesisId: anam.id,
      expectedVersion: anam.version,
      blocks: responderTudo(anam.blocks),
    })
    await finalizarAnamnese({ anamnesisId: anam.id, expectedVersion: salvo.version })

    const requisito = await calcularParaCaso(caso.id)
    const confirmado = await confirmarRequisito({
      requirementId: requisito.id,
      expectedVersion: requisito.version,
      slotClassEscolhida: requisito.slotClass,
    })

    const vagas = await vagasCompativeis({ requirementId: confirmado.id, limite: 5 })
    const booking = await reservar({
      caseId: caso.id,
      requirementId: confirmado.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    return { caseId: caso.id, booking }
  }

  /** Caso com a chegada registrada e a avaliação aberta. */
  async function casoEmAvaliacao() {
    const { caseId, booking } = await casoAgendado()
    const chegou = await registrarChegada({
      bookingId: booking.id,
      expectedVersion: booking.version,
    })
    const caso = await obterCaso(caseId)
    const encontro = await iniciarEncontro({
      caseId,
      bookingId: chegou.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    return { caseId, bookingId: chegou.id, encontro }
  }

  /** Avaliação preenchida por inteiro — o que a publicação exige. */
  function avaliacaoCompleta(): AvaliacaoRascunhoV1 {
    const dito = (texto: string) => ({ estado: 'ANSWERED' as const, texto })
    return {
      ...rascunhoVazio(),
      confirmacao: { pessoaConfere: true, procedimentoConfere: true, nota: null },
      entrevista: {
        historiaIntervalo: dito('Sem mudança desde a entrevista de enfermagem.'),
        sintomasAtuais: dito('Assintomática no momento.'),
      },
      exame: {
        geral: dito('Bom estado geral.'),
        viaAerea: dito('Abertura bucal preservada.'),
        revisaoSinaisVitais: dito('Sinais aferidos pela enfermagem revisados.'),
        achadosAdicionais: { estado: 'NOT_APPLICABLE', texto: null },
      },
      sintese: { resumo: 'Avaliação sem achados que mudem a condução.', limitacoes: [] },
    }
  }

  const CONTEUDO: ResultadoConteudoV1 = {
    _v: 1,
    resumoDaAvaliacao: 'Avaliação pré-anestésica conduzida em consulta presencial.',
    conclusao: 'Avaliação concluída; achados e limitações registrados nesta versão.',
    recomendacoes: ['Manter jejum conforme orientação do serviço.'],
    limitacoes: [],
    orientacoesDeRetorno: null,
  }

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-avaliacao-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    await initDb()
    await createTables()
    await garantirContaSintetica()
    await seedProtocolos()
    await execute(
      `INSERT INTO catalogo_servicos_solicitantes (id, nome) VALUES ('oftalmologia', 'Oftalmologia')
       ON CONFLICT (id) DO NOTHING`,
    )
    await semearCapacidade()
  }, 90_000)

  afterAll(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  /* ── chegada e ausência ── */

  it('a chegada põe o caso na porta do anestesista, e ninguém mais', async () => {
    const { caseId, booking } = await casoAgendado()
    const chegou = await registrarChegada({ bookingId: booking.id, expectedVersion: booking.version })

    expect(chegou.status).toBe('CHECKED_IN')
    expect(chegou.checkedInAt).not.toBeNull()
    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('WAITING_ANESTHESIA')
    expect(caso.timeline.at(-1)?.eventType).toBe('BOOKING_CHECKED_IN')
    // Check-in não inicia avaliação: encontro nenhum foi criado.
    expect(await obterEncontro(caseId)).toBeNull()
  })

  it('a ausência é afirmada por gente e devolve o caso para a fila', async () => {
    const { caseId, booking } = await casoAgendado()
    const faltou = await registrarAusencia({
      bookingId: booking.id,
      expectedVersion: booking.version,
      nota: 'Ninguém compareceu no horário.',
    })

    expect(faltou.status).toBe('NO_SHOW')
    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('READY_FOR_SCHEDULING')
    expect(caso.timeline.at(-1)?.eventType).toBe('BOOKING_NO_SHOW')
    expect(caso.timeline.at(-1)?.reason).toBe('Ninguém compareceu no horário.')
  })

  it('nenhum comando de avaliação ou agenda dispara por relógio', async () => {
    const pastas = ['src/main/clinical', 'src/main/scheduling']
    for (const pasta of pastas) {
      for (const arquivo of await readdir(pasta)) {
        const fonte = await readFile(path.join(pasta, arquivo), 'utf-8')
        expect(fonte).not.toMatch(/setInterval|setTimeout|node-cron|schedule\(/)
      }
    }
  })

  /* ── encontro ── */

  it('a avaliação recusa começar sem chegada registrada', async () => {
    const { caseId, booking } = await casoAgendado()
    const caso = await obterCaso(caseId)

    await expect(
      iniciarEncontro({
        caseId,
        bookingId: booking.id,
        expectedCaseVersion: caso.version,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ codigo: 'INVALID_TRANSITION' })
  })

  it('começar consome a vaga mas não conclui o atendimento', async () => {
    const { caseId, bookingId, encontro } = await casoEmAvaliacao()

    expect(encontro.status).toBe('IN_PROGRESS')
    expect(encontro.assessment.state).toBe('DRAFT')
    expect(encontro.sequence).toBe(1)
    expect(encontro.responsibleActor.role).toBe('ANESTESIOLOGISTA')

    const booking = await queryOne<{ status: string }>(
      `SELECT status FROM scheduling_bookings WHERE id = $1`,
      bookingId,
    )
    expect(booking?.status).toBe('COMPLETED')

    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('IN_ASSESSMENT')
  })

  it('a mesma chave de idempotência não abre um segundo encontro', async () => {
    const { caseId, booking } = await casoAgendado()
    const chegou = await registrarChegada({ bookingId: booking.id, expectedVersion: booking.version })
    const caso = await obterCaso(caseId)
    const chave = randomUUID()

    const primeiro = await iniciarEncontro({
      caseId,
      bookingId: chegou.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: chave,
    })
    const segundo = await iniciarEncontro({
      caseId,
      bookingId: chegou.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: chave,
    })
    expect(segundo.id).toBe(primeiro.id)
  })

  it('o rascunho da avaliação recusa escrita de versão velha', async () => {
    const { encontro } = await casoEmAvaliacao()
    await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })

    await expect(
      salvarAvaliacao({
        encounterId: encontro.id,
        expectedVersion: encontro.version,
        assessment: avaliacaoCompleta(),
      }),
    ).rejects.toMatchObject({ codigo: 'VERSION_CONFLICT' })
  })

  it('interromper preserva o episódio e devolve o caso para remarcar', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const parado = await interromperEncontro({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      motivo: 'Paciente precisou sair antes de concluir a avaliação.',
    })

    expect(parado.status).toBe('COMPLETED')
    expect(parado.completionReason).toBe('INTERRUPTED')
    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('READY_FOR_SCHEDULING')
    expect(caso.timeline.at(-1)?.eventType).toBe('ENCOUNTER_INTERRUPTED')
  })

  /* ── pendências ── */

  it('pendência não bloqueadora não impede emitir resultado', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })

    await abrirPendencia({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      kind: 'OTHER',
      ownerRole: 'RECEPCAO',
      impact: 'OPERATIONAL_ONLY',
      description: 'Conferir o telefone de contato antes da cirurgia.',
      requested: { _v: 1, titulo: 'Telefone de contato', perguntaClinica: null, instrucoes: null },
    })

    // O caso foi para PENDING, e ainda assim a emissão precisa ser possível:
    // o que trava é impacto declarado, não a existência de item aberto.
    const emPendencia = await obterEncontro(caseId)
    expect(emPendencia?.status).toBe('WAITING_PENDING')
    expect(emPendencia?.canResumeReview).toBe(true)

    const retomado = await retomarRevisao({
      encounterId: encontro.id,
      expectedVersion: emPendencia!.version,
    })
    expect(retomado.reviewCycle).toBe(2)

    const resultado = await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: retomado.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })
    expect(resultado.versionNumber).toBe(1)

    const depois = await obterResultadoDoCaso(caseId)
    expect(depois.pendencies).toHaveLength(1)
    expect(depois.pendencies[0].status).toBe('REQUESTED')
  })

  it('entregar a resposta não é a resposta ser aceita', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const pendencia = await abrirPendencia({
      encounterId: encontro.id,
      expectedEncounterVersion: encontro.version,
      kind: 'EXAM',
      ownerRole: 'SOLICITANTE',
      impact: 'BLOCKS_CURRENT_RESULT',
      description: 'Falta o eletrocardiograma recente pedido pelo serviço.',
      requested: {
        _v: 1,
        titulo: 'Eletrocardiograma',
        perguntaClinica: 'Há alteração de condução?',
        instrucoes: null,
      },
    })

    expect(pendencia.targetServiceId).not.toBeNull()
    let estado = await obterResultadoDoCaso(caseId)
    expect(estado.blockers).toBe(1)
    expect(estado.encounter?.canResumeReview).toBe(false)

    const respondida = await submeterEvidencia({
      pendencyId: pendencia.id,
      expectedVersion: pendencia.version,
      evidence: {
        _v: 1,
        desfecho: 'RECEIVED',
        texto: 'Laudo trazido pela paciente, emitido há dois meses.',
        observadoEm: null,
        nota: null,
      },
    })
    expect(respondida.status).toBe('EVIDENCE_SUBMITTED')

    // Entregue e ainda assim bloqueando: quem decide suficiência é outro ato.
    estado = await obterResultadoDoCaso(caseId)
    expect(estado.blockers).toBe(1)
    expect(estado.encounter?.canResumeReview).toBe(false)

    const recusada = await revisarEvidencia({
      pendencyId: respondida.id,
      expectedVersion: respondida.version,
      decisao: 'REOPEN_AS_INSUFFICIENT',
      motivo: 'O laudo não responde à pergunta clínica do pedido.',
    })
    expect(recusada.status).toBe('INSUFFICIENT_REOPENED')
    expect((await obterResultadoDoCaso(caseId)).blockers).toBe(1)

    const denovo = await submeterEvidencia({
      pendencyId: recusada.id,
      expectedVersion: recusada.version,
      evidence: {
        _v: 1,
        desfecho: 'RECEIVED',
        texto: 'Novo traçado, feito nesta semana, com laudo do cardiologista.',
        observadoEm: null,
        nota: null,
      },
    })
    const aceita = await revisarEvidencia({
      pendencyId: denovo.id,
      expectedVersion: denovo.version,
      decisao: 'ACCEPT',
      motivo: 'O traçado responde ao que foi perguntado.',
    })
    expect(aceita.status).toBe('RESOLVED_ACCEPTED')

    estado = await obterResultadoDoCaso(caseId)
    expect(estado.blockers).toBe(0)
    expect(estado.encounter?.canResumeReview).toBe(true)
  })

  it('emitir com bloqueio vivo falha, e o caso não muda', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    const pendencia = await abrirPendencia({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      kind: 'INFORMATION',
      ownerRole: 'ENFERMAGEM',
      impact: 'BLOCKS_CURRENT_RESULT',
      description: 'Falta confirmar qual anticoagulante a paciente usa.',
      requested: { _v: 1, titulo: 'Anticoagulante em uso', perguntaClinica: null, instrucoes: null },
    })

    const emEspera = await obterEncontro(caseId)
    await expect(
      finalizarResultado({
        encounterId: encontro.id,
        expectedEncounterVersion: emEspera!.version,
        content: CONTEUDO,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ codigo: 'INVALID_TRANSITION' })

    await expect(
      retomarRevisao({ encounterId: encontro.id, expectedVersion: emEspera!.version }),
    ).rejects.toMatchObject({ codigo: 'OPEN_BLOCKERS' })

    // Encerrar a pendência também libera — desde que com motivo e autoria.
    const encerrada = await cancelarPendencia({
      pendencyId: pendencia.id,
      expectedVersion: pendencia.version,
      motivo: 'A informação chegou pela própria paciente durante a consulta.',
    })
    expect(encerrada.status).toBe('CANCELLED')
    expect((await obterResultadoDoCaso(caseId)).blockers).toBe(0)
  })

  /* ── resultado ── */

  it('publicar exige avaliação completa e diz o que falta', async () => {
    const { encontro } = await casoEmAvaliacao()

    await expect(
      finalizarResultado({
        encounterId: encontro.id,
        expectedEncounterVersion: encontro.version,
        content: CONTEUDO,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/confirmação da pessoa/)
  })

  it('a versão emitida é imutável no banco, não só na aplicação', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    const resultado = await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })

    expect(resultado.emissionType).toBe('FINAL')
    expect(resultado.contentHash).toHaveLength(64)
    expect(resultado.isCurrent).toBe(true)

    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('READY_FOR_HANDOFF')
    const encerrado = await obterEncontro(caseId)
    expect(encerrado?.status).toBe('COMPLETED')
    expect(encerrado?.completionReason).toBe('RESULT_FINALIZED')
    expect(encerrado?.assessment.state).toBe('COMPLETE')

    await expect(
      execute(`UPDATE preop_results SET reason = 'reescrita' WHERE id = $1`, resultado.id),
    ).rejects.toThrow(/imutável/)
    await expect(
      execute(`DELETE FROM preop_results WHERE id = $1`, resultado.id),
    ).rejects.toThrow(/imutável/)
  })

  it('corrigir cria a próxima versão e preserva a anterior', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    const v1 = await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })

    const head = await queryOne<{ version: number }>(
      `SELECT version FROM preop_result_heads WHERE case_id = $1`,
      caseId,
    )
    const v2 = await revisarResultado({
      caseId,
      expectedHeadVersion: head!.version,
      predecessorResultId: v1.id,
      emissionType: 'CORRECTION',
      reason: 'A conclusão citava o olho errado.',
      content: { ...CONTEUDO, conclusao: 'Conclusão corrigida quanto à lateralidade.' },
    })

    expect(v2.versionNumber).toBe(2)
    expect(v2.emissionType).toBe('CORRECTION')
    expect(v2.predecessorResultId).toBe(v1.id)

    const estado = await obterResultadoDoCaso(caseId)
    expect(estado.current?.id).toBe(v2.id)
    expect(estado.history).toHaveLength(2)
    expect(estado.history.find((r) => r.id === v1.id)?.isCurrent).toBe(false)

    // Corrigir a versão que já não é corrente é recusado.
    await expect(
      revisarResultado({
        caseId,
        expectedHeadVersion: head!.version + 1,
        predecessorResultId: v1.id,
        emissionType: 'ADDENDUM',
        reason: 'Tentativa de aditar versão superada.',
        content: CONTEUDO,
      }),
    ).rejects.toMatchObject({ codigo: 'RESULT_VERSION_CONFLICT' })
  })

  /* ── entrega ── */

  it('disponibilizar não encerra o caso; confirmar o recebimento encerra', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })

    const entrega = await enviarEntrega({ caseId, idempotencyKey: randomUUID() })
    expect(entrega.status).toBe('SENT')
    expect(entrega.channel).toBe('LOCAL_DEMO')
    expect(entrega.serviceName).toBeTruthy()
    expect((await obterCaso(caseId)).status).toBe('READY_FOR_HANDOFF')

    const recebida = await confirmarRecebimento({
      deliveryId: entrega.id,
      expectedVersion: entrega.version,
    })
    expect(recebida.status).toBe('RECEIVED')
    expect(recebida.receivedBy?.role).toBe('SOLICITANTE')

    const caso = await obterCaso(caseId)
    expect(caso.status).toBe('DELIVERED_TO_REQUESTER')
    expect(caso.responsibility.currentRoles).toEqual([])
    expect(caso.timeline.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        'BOOKING_CHECKED_IN',
        'ENCOUNTER_STARTED',
        'RESULT_FINALIZED',
        'DELIVERY_SENT',
        'DELIVERY_ACKNOWLEDGED',
      ]),
    )
  })

  it('uma correção depois da entrega devolve o caso para entregar de novo', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    const v1 = await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })
    const entrega = await enviarEntrega({ caseId, idempotencyKey: randomUUID() })

    const head = await queryOne<{ version: number }>(
      `SELECT version FROM preop_result_heads WHERE case_id = $1`,
      caseId,
    )
    await revisarResultado({
      caseId,
      expectedHeadVersion: head!.version,
      predecessorResultId: v1.id,
      emissionType: 'ADDENDUM',
      reason: 'Chegou o laudo que faltava e ele muda a orientação.',
      content: { ...CONTEUDO, limitacoes: ['Laudo anterior estava incompleto.'] },
    })

    expect((await obterCaso(caseId)).status).toBe('READY_FOR_HANDOFF')

    // Confirmar o recebimento da versão velha é recusado: o que precisa
    // chegar ao solicitante é a que está valendo.
    await expect(
      confirmarRecebimento({ deliveryId: entrega.id, expectedVersion: entrega.version }),
    ).rejects.toMatchObject({ codigo: 'RESULT_VERSION_CONFLICT' })

    const nova = await enviarEntrega({ caseId, idempotencyKey: randomUUID() })
    expect(nova.id).not.toBe(entrega.id)
    const recebida = await confirmarRecebimento({
      deliveryId: nova.id,
      expectedVersion: nova.version,
    })
    expect(recebida.status).toBe('RECEIVED')
    expect((await obterCaso(caseId)).status).toBe('DELIVERED_TO_REQUESTER')

    // O recibo antigo continua lá: ele explica o que o serviço leu antes.
    const entregas = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM result_deliveries WHERE case_id = $1`,
      caseId,
    )
    expect(entregas?.total).toBe(2)
  })

  /* ── cancelamento do caso ── */

  it('cancelar o caso derruba a consulta marcada e preserva a história', async () => {
    const { caseId, booking } = await casoAgendado()
    const antes = await obterCaso(caseId)
    const eventosAntes = antes.timeline.length

    const cancelado = await cancelarCaso({
      caseId,
      motivo: 'A cirurgia foi desmarcada pelo serviço solicitante.',
      expectedCaseVersion: antes.version,
    })

    expect(cancelado.status).toBe('CANCELLED')
    expect(cancelado.responsibility.currentRoles).toEqual([])
    expect(cancelado.timeline).toHaveLength(eventosAntes + 1)
    expect(cancelado.timeline.at(-1)?.eventType).toBe('CASE_CANCELLED')
    expect(cancelado.timeline.at(-1)?.reason).toMatch(/desmarcada/)

    const vaga = await queryOne<{ status: string }>(
      `SELECT status FROM scheduling_bookings WHERE id = $1`,
      booking.id,
    )
    expect(vaga?.status).toBe('CANCELLED')

    await expect(
      cancelarCaso({ caseId, motivo: 'Tentativa repetida.', expectedCaseVersion: cancelado.version }),
    ).rejects.toMatchObject({ codigo: 'INVALID_TRANSITION' })
  })

  it('caso com resultado emitido não é cancelado: o caminho é corrigir', async () => {
    const { caseId, encontro } = await casoEmAvaliacao()
    const salvo = await salvarAvaliacao({
      encounterId: encontro.id,
      expectedVersion: encontro.version,
      assessment: avaliacaoCompleta(),
    })
    await finalizarResultado({
      encounterId: encontro.id,
      expectedEncounterVersion: salvo.version,
      content: CONTEUDO,
      idempotencyKey: randomUUID(),
    })
    const caso = await obterCaso(caseId)

    await expect(
      cancelarCaso({
        caseId,
        motivo: 'Tentativa de apagar o que já foi comunicado.',
        expectedCaseVersion: caso.version,
      }),
    ).rejects.toThrow(/Corrija a versão/)
  })

  it('o esquema de avaliação não guarda nada que pareça paciente longitudinal', async () => {
    const colunas = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'anesthesia_encounters', 'case_pendencies', 'preop_results',
            'preop_result_heads', 'result_deliveries'
          )
          AND (column_name LIKE 'patient%' OR column_name LIKE 'mrn%')`,
    )
    expect(colunas?.total).toBe(0)
  })

  it('ErroDeCaso do domínio viaja com código legível', async () => {
    const erro = new ErroDeCaso('OPEN_BLOCKERS', 'Ainda há pendência impeditiva.')
    expect(erro.codigo).toBe('OPEN_BLOCKERS')
  })
})
