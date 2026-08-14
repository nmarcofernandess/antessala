import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, queryAll, queryOne } from '../../../src/main/db/query'
import { garantirContaSintetica } from '../../../src/main/auth/session'
import { seedProtocolos } from '../../../src/main/db/protocolos'
import { semearCapacidade } from '../../../src/main/scheduling/capacity-seed'
import {
  aceitarHandoff,
  criarCaso,
  listarCasos,
  obterCaso,
} from '../../../src/main/clinical/case-service'
import {
  abrirAnamnese,
  finalizarAnamnese,
  obterAnamnese,
  salvarRascunho,
} from '../../../src/main/clinical/anamnesis-service'
import {
  calcularParaCaso,
  confirmarRequisito,
} from '../../../src/main/clinical/requirement-service'
import {
  cancelarReserva,
  filaParaAgendar,
  listarIntervalo,
  moverReserva,
  reservar,
  vagasCompativeis,
} from '../../../src/main/scheduling/agenda-service'
import { responder } from '../../../src/shared/clinical/anamnese-tipos'
import { ErroDeCaso, serializarErro, type AnamnesisBlock } from '../../../src/shared/clinical/caso'

/**
 * A vertical inteira contra o banco de verdade.
 *
 * Encaminhamento → caso → handoff → entrevista → requisito → reserva. O que
 * estes testes protegem não é uma função: é a promessa de que a história do
 * caso existe, é append-only, e que a agenda recusa o que não cabe.
 */
describe('fluxo do caso pré-anestésico', () => {
  let dbDir: string

  async function abrirServico(): Promise<string> {
    const s = await queryOne<{ id: string }>(
      `SELECT id FROM catalogo_servicos_solicitantes ORDER BY nome LIMIT 1`,
    )
    return s!.id
  }

  async function novoCaso(procedimento = 'Facectomia com implante') {
    return criarCaso({
      person: {
        fullName: 'Maria Aparecida Rocha',
        birthDate: '1958-04-12',
        sexReported: 'FEMININO',
      },
      referral: { sourceReference: null, freeTextReference: 'Papel do ambulatório' },
      procedure: { description: procedimento, lateralityOrSite: 'Direita', notes: null },
      requester: { serviceId: await abrirServico(), physicianName: 'Dr. Aurélio Prado' },
      idempotencyKey: randomUUID(),
    })
  }

  /** Responde tudo que a composição pede, sem inventar achado. */
  function responderTudo(blocos: AnamnesisBlock[]): AnamnesisBlock[] {
    const negativa = () => responder(false)
    return blocos.map((b) => {
      const d = { ...(b.dados as Record<string, unknown>) }
      for (const [chave, valor] of Object.entries(d)) {
        if (valor && typeof valor === 'object' && 'estado' in (valor as object)) {
          d[chave] = negativa()
        }
      }
      if (b.tipo === 'procedure_context') d.indicacao = 'Catarata em olho direito'
      if (b.tipo === 'clinical_notes') d.nota = 'Paciente orientada e colaborativa.'
      if (b.tipo === 'exams_pending') d.itens = [{ id: 'e1', nome: 'Hemograma', status: 'DISPONIVEL' }]
      if (b.tipo === 'vital_signs') {
        for (const chave of ['sistolica', 'diastolica', 'frequenciaCardiaca', 'saturacao', 'peso', 'altura']) {
          d[chave] = responder(100)
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

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-fluxo-'))
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

  it('abrir um caso grava abertura e handoff na mesma transação', async () => {
    const caso = await novoCaso()

    expect(caso.displayCode).toMatch(/^ANT-\d{4}-\d{4}$/)
    expect(caso.status).toBe('WAITING_NURSING')
    expect(caso.version).toBe(2)
    expect(caso.timeline.map((e) => e.eventType)).toEqual(['CASE_OPENED', 'HANDOFF_SENT'])
    expect(caso.timeline[0].sequence).toBe(1)
    expect(caso.timeline[1].sequence).toBe(2)
    expect(caso.timeline[0].actor.role).toBe('RECEPCAO')
    expect(caso.openHandoff?.toRole).toBe('ENFERMAGEM')
    expect(caso.person.ageYearsAtOpening).toBeGreaterThan(60)
  })

  it('a mesma pessoa em dois encaminhamentos vira dois casos autônomos', async () => {
    const a = await novoCaso()
    const b = await novoCaso()
    expect(a.id).not.toBe(b.id)
    expect(a.displayCode).not.toBe(b.displayCode)
    expect(a.person.fullName).toBe(b.person.fullName)
  })

  it('a mesma chave de idempotência devolve o caso de antes, não um novo', async () => {
    const chave = randomUUID()
    const entrada = {
      person: { fullName: 'João Ribeiro', birthDate: '1970-01-01', sexReported: 'MASCULINO' as const },
      referral: { sourceReference: 'GUIA-42', freeTextReference: 'Guia 42' },
      procedure: { description: 'Colonoscopia diagnóstica', lateralityOrSite: null, notes: null },
      requester: { serviceId: await abrirServico(), physicianName: 'Dra. Helena Lima' },
      idempotencyKey: chave,
    }
    const primeiro = await criarCaso(entrada)
    const segundo = await criarCaso(entrada)
    expect(segundo.id).toBe(primeiro.id)
  })

  it('a timeline é append-only: o banco recusa apagar história', async () => {
    const caso = await novoCaso()
    await expect(
      execute(`DELETE FROM case_events WHERE case_id = $1`, caso.id),
    ).rejects.toThrow(/append-only/)
  })

  it('a enfermagem assume o caso e a responsabilidade muda', async () => {
    const caso = await novoCaso()
    const assumido = await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })

    expect(assumido.status).toBe('NURSING_IN_PROGRESS')
    expect(assumido.openHandoff).toBeNull()
    expect(assumido.timeline.at(-1)?.eventType).toBe('HANDOFF_ACKNOWLEDGED')
    expect(assumido.timeline.at(-1)?.actor.role).toBe('ENFERMAGEM')
    expect(assumido.responsibility.currentRoles).toContain('ENFERMAGEM')
  })

  it('versão desatualizada não assume o caso em silêncio', async () => {
    const caso = await novoCaso()
    await expect(
      aceitarHandoff({
        caseId: caso.id,
        handoffId: caso.openHandoff!.id,
        expectedCaseVersion: 99,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/VERSION_CONFLICT|mudou/)
  })

  it('a entrevista nasce com a composição do protocolo e sem nenhuma resposta', async () => {
    const caso = await novoCaso('Facectomia com implante')
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })

    const anamnese = await abrirAnamnese(caso.id)
    expect(anamnese.protocolId).toBe('facectomia')
    expect(anamnese.protocolBlocks).toHaveLength(9)
    expect(anamnese.blocks).toHaveLength(9)
    expect(anamnese.status).toBe('DRAFT')

    // Nascer em silêncio é a lei: nenhuma negativa foi registrada por ninguém.
    const alergias = anamnese.blocks.find((b) => b.tipo === 'allergies')!
    expect((alergias.dados as { temAlergia: { estado: string } }).temAlergia.estado).toBe(
      'NAO_PERGUNTADO',
    )
  })

  it('o rascunho sobrevive: salvar e reler devolve o que foi digitado', async () => {
    const caso = await novoCaso()
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)

    const comResposta = anamnese.blocks.map((b) =>
      b.tipo === 'allergies' ? { ...b, dados: { temAlergia: responder(true), itens: [] } } : b,
    )
    await salvarRascunho({
      anamnesisId: anamnese.id,
      expectedVersion: anamnese.version,
      blocks: comResposta,
    })

    const relida = await obterAnamnese(caso.id)
    const alergias = relida!.blocks.find((b) => b.tipo === 'allergies')!
    expect((alergias.dados as { temAlergia: { valor: boolean } }).temAlergia.valor).toBe(true)
  })

  it('não publica entrevista com a composição incompleta', async () => {
    const caso = await novoCaso()
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)

    await expect(
      finalizarAnamnese({ anamnesisId: anamnese.id, expectedVersion: anamnese.version }),
    ).rejects.toThrow(/sem resposta/)
  })

  it('entrevista completa publica revisão imutável e calcula requisito', async () => {
    const caso = await novoCaso()
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)
    const salva = await salvarRascunho({
      anamnesisId: anamnese.id,
      expectedVersion: anamnese.version,
      blocks: responderTudo(anamnese.blocks),
    })

    const { anamnesis } = await finalizarAnamnese({
      anamnesisId: salva.id,
      expectedVersion: salva.version,
    })
    expect(anamnesis.status).toBe('FINAL')
    expect(anamnesis.revision).toBe(1)

    // A revisão publicada é imutável.
    await expect(
      execute(`UPDATE clinical_anamnesis_revisions SET revision = 9 WHERE anamnesis_id = $1`, anamnesis.id),
    ).rejects.toThrow(/imutável/)

    // Rascunho publicado não aceita mais edição.
    await expect(
      salvarRascunho({
        anamnesisId: anamnesis.id,
        expectedVersion: anamnesis.version,
        blocks: anamnesis.blocks,
      }),
    ).rejects.toThrow(/finalizada/)

    const requisito = await calcularParaCaso(caso.id)
    expect(requisito.status).toBe('CALCULATED')
    expect(requisito.slotClass).toBe('QUICK')
    expect(requisito.calculatedMinutes).toBe(20)
    expect(requisito.operationalExplanation.join(' ')).not.toMatch(/alergia|diagnóstic|ASA/i)
  })

  it('o requisito só publica o caso quando uma pessoa confirma', async () => {
    const caso = await novoCaso()
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)
    const salva = await salvarRascunho({
      anamnesisId: anamnese.id,
      expectedVersion: anamnese.version,
      blocks: responderTudo(anamnese.blocks),
    })
    await finalizarAnamnese({ anamnesisId: salva.id, expectedVersion: salva.version })
    const requisito = await calcularParaCaso(caso.id)

    // Calculado ainda não é agendável.
    expect((await obterCaso(caso.id)).status).toBe('NURSING_IN_PROGRESS')
    await expect(vagasCompativeis({ requirementId: requisito.id })).rejects.toThrow(/confirmado/)

    const confirmado = await confirmarRequisito({
      requirementId: requisito.id,
      expectedVersion: requisito.version,
    })
    expect(confirmado.status).toBe('CONFIRMED')
    expect((await obterCaso(caso.id)).status).toBe('READY_FOR_SCHEDULING')

    const fila = await filaParaAgendar()
    expect(fila.some((f) => f.caseId === caso.id)).toBe(true)
  })

  it('trocar a classe da vaga exige motivo e grava override', async () => {
    const caso = await novoCaso()
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)
    const salva = await salvarRascunho({
      anamnesisId: anamnese.id,
      expectedVersion: anamnese.version,
      blocks: responderTudo(anamnese.blocks),
    })
    await finalizarAnamnese({ anamnesisId: salva.id, expectedVersion: salva.version })
    const requisito = await calcularParaCaso(caso.id)

    await expect(
      confirmarRequisito({
        requirementId: requisito.id,
        expectedVersion: requisito.version,
        slotClassEscolhida: 'EXTENDED',
        motivo: 'curto',
      }),
    ).rejects.toThrow(/motivo/)

    const ajustado = await confirmarRequisito({
      requirementId: requisito.id,
      expectedVersion: requisito.version,
      slotClassEscolhida: 'EXTENDED',
      motivo: 'Paciente com dificuldade de audição, a conversa vai demorar mais.',
    })
    expect(ajustado.status).toBe('OVERRIDDEN')
    expect(ajustado.durationMinutes).toBe(50)

    const overrides = await queryAll(`SELECT * FROM scheduling_overrides WHERE requirement_id = $1`, requisito.id)
    expect(overrides).toHaveLength(1)
  })

  async function casoPronto(procedimento = 'Facectomia com implante') {
    const caso = await novoCaso(procedimento)
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anamnese = await abrirAnamnese(caso.id)
    const salva = await salvarRascunho({
      anamnesisId: anamnese.id,
      expectedVersion: anamnese.version,
      blocks: responderTudo(anamnese.blocks),
    })
    await finalizarAnamnese({ anamnesisId: salva.id, expectedVersion: salva.version })
    const requisito = await calcularParaCaso(caso.id)
    const confirmado = await confirmarRequisito({
      requirementId: requisito.id,
      expectedVersion: requisito.version,
    })
    return { caso, requisito: confirmado }
  }

  it('reservar grava a consulta, muda o caso e aparece na timeline', async () => {
    const { caso, requisito } = await casoPronto()
    const vagas = await vagasCompativeis({ requirementId: requisito.id })
    expect(vagas.length).toBeGreaterThan(0)
    expect(vagas.every((v) => v.slotClass === requisito.slotClass)).toBe(true)

    const booking = await reservar({
      caseId: caso.id,
      requirementId: requisito.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    expect(booking.status).toBe('CONFIRMED')
    expect(booking.slotClass).toBe(requisito.slotClass)

    const depois = await obterCaso(caso.id)
    expect(depois.status).toBe('SCHEDULED')
    expect(depois.booking?.id).toBe(booking.id)
    expect(depois.timeline.at(-1)?.eventType).toBe('BOOKING_CONFIRMED')

    const intervalo = await listarIntervalo({
      de: new Date(Date.parse(booking.startsAt) - 3600_000).toISOString(),
      ate: new Date(Date.parse(booking.startsAt) + 3600_000).toISOString(),
    })
    const slot = intervalo.slots.find((s) => s.id === booking.slotId)
    expect(slot?.booking?.id).toBe(booking.id)
  })

  it('duas reservas na mesma vaga: a segunda perde no banco', async () => {
    const a = await casoPronto()
    const b = await casoPronto()
    const vagas = await vagasCompativeis({ requirementId: a.requisito.id })

    await reservar({
      caseId: a.caso.id,
      requirementId: a.requisito.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    await expect(
      reservar({
        caseId: b.caso.id,
        requirementId: b.requisito.id,
        slotId: vagas[0].id,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/SLOT_TAKEN|reservada/)
  })

  it('vaga de classe errada é recusada', async () => {
    const { caso, requisito } = await casoPronto()
    const outraClasse = await queryOne<{ id: string }>(
      `SELECT id FROM scheduling_slots
        WHERE slot_class <> $1 AND status = 'OPEN'
          AND NOT EXISTS (SELECT 1 FROM scheduling_bookings b WHERE b.slot_id = scheduling_slots.id
                            AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED'))
        LIMIT 1`,
      requisito.slotClass,
    )

    const erro = await reservar({
      caseId: caso.id,
      requirementId: requisito.id,
      slotId: outraClasse!.id,
      idempotencyKey: randomUUID(),
    }).catch((e) => e)

    expect(erro).toBeInstanceOf(ErroDeCaso)
    expect((erro as ErroDeCaso).codigo).toBe('INCOMPATIBLE_SLOT')
    // O renderer recebe o código na frente para reagir sem adivinhar.
    expect(serializarErro(erro)).toMatch(/^INCOMPATIBLE_SLOT: /)
  })

  it('mover a reserva valida no main e registra remarcação', async () => {
    const { caso, requisito } = await casoPronto()
    const vagas = await vagasCompativeis({ requirementId: requisito.id })
    const booking = await reservar({
      caseId: caso.id,
      requirementId: requisito.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    const movido = await moverReserva({
      bookingId: booking.id,
      slotId: vagas[1].id,
      expectedVersion: booking.version,
    })
    expect(movido.slotId).toBe(vagas[1].id)
    expect(movido.startsAt).toBe(vagas[1].startsAt)

    const depois = await obterCaso(caso.id)
    expect(depois.timeline.at(-1)?.eventType).toBe('BOOKING_RESCHEDULED')
  })

  it('cancelar a consulta devolve o caso à fila sem cancelar o caso', async () => {
    const { caso, requisito } = await casoPronto()
    const vagas = await vagasCompativeis({ requirementId: requisito.id })
    const booking = await reservar({
      caseId: caso.id,
      requirementId: requisito.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    const cancelado = await cancelarReserva({
      bookingId: booking.id,
      motivo: 'Paciente pediu para remarcar por conflito de transporte.',
      expectedVersion: booking.version,
    })
    expect(cancelado.status).toBe('CANCELLED')

    const depois = await obterCaso(caso.id)
    expect(depois.status).toBe('READY_FOR_SCHEDULING')
    expect(depois.booking).toBeNull()
  })

  it('a listagem projeta reserva e requisito sem expor conteúdo clínico', async () => {
    const { caso, requisito } = await casoPronto()
    const vagas = await vagasCompativeis({ requirementId: requisito.id })
    await reservar({
      caseId: caso.id,
      requirementId: requisito.id,
      slotId: vagas[0].id,
      idempotencyKey: randomUUID(),
    })

    const lista = await listarCasos({ status: ['SCHEDULED'] })
    const meu = lista.find((c) => c.id === caso.id)!
    expect(meu.booking?.slotClass).toBe(requisito.slotClass)
    expect(meu.requirement?.durationMinutes).toBe(requisito.durationMinutes)
    expect(JSON.stringify(meu)).not.toMatch(/patientId/)
  })

  it('nenhuma tabela do fluxo carrega identidade longitudinal de pessoa', async () => {
    const colunas = await queryAll<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name ILIKE '%patient%' OR column_name ILIKE '%paciente_id%')`,
    )
    expect(colunas).toEqual([])
  })
})
