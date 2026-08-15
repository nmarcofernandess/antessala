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
import { listarRecursos, salvarRecurso } from '../../../src/main/scheduling/capacity-service'
import {
  capacidadeDoDia,
  diaDaSala,
  encaixesNoDia,
  obterDisponibilidade,
  salvarDisponibilidade,
} from '../../../src/main/scheduling/availability-service'
import { reservar, sugerirHorarios } from '../../../src/main/scheduling/agenda-service'
import { criarCaso, aceitarHandoff } from '../../../src/main/clinical/case-service'
import {
  abrirAnamnese,
  finalizarAnamnese,
  salvarRascunho,
} from '../../../src/main/clinical/anamnesis-service'
import {
  calcularParaCaso,
  confirmarRequisito,
} from '../../../src/main/clinical/requirement-service'
import { responder } from '../../../src/shared/clinical/anamnese-tipos'
import type { AnamnesisBlock } from '../../../src/shared/clinical/caso'

/**
 * A disponibilidade é a regra, e nada é materializado dela.
 *
 * O que estes testes protegem: o livre é sempre calculado do expediente menos o
 * que já existe; a cota reserva tempo por classe sem criar horário; e mudar a
 * regra nunca toca no que já virou compromisso com uma pessoa.
 */
describe('disponibilidade e capacidade', () => {
  let dbDir: string

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-disp-'))
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

  /** A próxima segunda-feira — dia que o seed deixa aberto em todas as salas. */
  function proximaSegunda(): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    do {
      d.setDate(d.getDate() + 1)
    } while (d.getDay() !== 1)
    return d
  }

  it('o primeiro boot deixa três salas com regra de dias úteis e nenhuma vaga criada', async () => {
    const disp = await obterDisponibilidade()
    expect(disp).toHaveLength(3)

    const primeira = disp[0]
    expect(primeira.dias).toHaveLength(7)
    expect(primeira.dias[0].ativo).toBe(false) // domingo fechado
    expect(primeira.dias[1].ativo).toBe(true) // segunda aberta
    expect(primeira.dias[1].pausas).toHaveLength(1) // almoço
    expect(primeira.cotas.QUICK + primeira.cotas.STANDARD + primeira.cotas.EXTENDED).toBe(100)

    // Nada de horário é pré-criado: a tabela de vagas não existe mais.
    const tabela = await queryOne<{ existe: boolean }>(
      `SELECT to_regclass('public.scheduling_slots') IS NOT NULL AS existe`,
    )
    expect(tabela?.existe).toBe(false)
  })

  it('o dia livre é o expediente menos a pausa, calculado na hora', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[0]
    const pausa = sala.dias[1].pausas[0]

    const dia = (await diaDaSala(sala.resourceId, proximaSegunda()))!
    expect(dia).toBeTruthy()

    // A conta é feita no fuso local, como a tela lê — `EXTRACT` no banco
    // devolveria hora UTC e a comparação viraria mentira.
    const dentroDaPausa = dia.livres.filter((l) => {
      const min = l.inicio.getHours() * 60 + l.inicio.getMinutes()
      return min >= pausa.inicio && min < pausa.fim
    })
    expect(dentroDaPausa).toHaveLength(0)
    expect(dia.minutosLivres).toBe(
      sala.dias[1].fim - sala.dias[1].inicio - (pausa.fim - pausa.inicio),
    )
  })

  it('a cota reserva tempo por classe sem criar horário nenhum', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[0]
    await salvarDisponibilidade({
      resourceId: sala.resourceId,
      cotas: { QUICK: 60, STANDARD: 40, EXTENDED: 0 },
      dias: sala.dias,
    })

    const dia = (await diaDaSala(sala.resourceId, proximaSegunda()))!
    expect(dia.cota.QUICK.reservado).toBe(Math.round(dia.minutosDeAtendimento * 0.6))
    expect(dia.cota.EXTENDED.reservado).toBe(0)

    // Zero por cento significa "esta sala não atende isso" — e a recusa aparece
    // como ausência de encaixe, não como erro depois do clique.
    expect(encaixesNoDia(dia, 'EXTENDED')).toHaveLength(0)
    expect(encaixesNoDia(dia, 'QUICK').length).toBeGreaterThan(0)
    expect(capacidadeDoDia(dia).EXTENDED).toBe(0)

    await expect(
      salvarDisponibilidade({
        resourceId: sala.resourceId,
        cotas: { QUICK: 50, STANDARD: 40, EXTENDED: 0 },
        dias: sala.dias,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })

    await salvarDisponibilidade({
      resourceId: sala.resourceId,
      cotas: { QUICK: 40, STANDARD: 40, EXTENDED: 20 },
      dias: sala.dias,
    })
  })

  it('mudar a regra muda a agenda adiante sem migrar nada', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[0]

    // Sábado passa a abrir; a segunda encolhe para meio período.
    const dias = sala.dias.map((d) => {
      if (d.weekday === 6) return { ...d, ativo: true, inicio: 8 * 60, fim: 12 * 60, pausas: [] }
      if (d.weekday === 1) return { ...d, fim: 12 * 60, pausas: [] }
      return d
    })
    await salvarDisponibilidade({ resourceId: sala.resourceId, cotas: sala.cotas, dias })

    const segunda = (await diaDaSala(sala.resourceId, proximaSegunda()))!
    expect(segunda.livres.every((l) => l.fim.getHours() <= 12)).toBe(true)

    const sabado = proximaSegunda()
    sabado.setDate(sabado.getDate() + 5)
    const noSabado = await diaDaSala(sala.resourceId, sabado)
    expect(noSabado?.minutosLivres).toBeGreaterThan(0)
  })

  it('a consulta marcada sobrevive ao fechamento da sala', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[2]

    const caso = await criarCaso({
      person: { fullName: 'Rita Nogueira', birthDate: '1962-07-09', sexReported: 'FEMININO' },
      referral: { sourceReference: null, freeTextReference: 'Encaminhamento' },
      procedure: { description: 'Facectomia com implante', lateralityOrSite: null, notes: null },
      requester: { serviceId: 'oftalmologia', physicianName: 'Dra. Sofia Braga' },
      idempotencyKey: randomUUID(),
    })
    await aceitarHandoff({
      caseId: caso.id,
      handoffId: caso.openHandoff!.id,
      expectedCaseVersion: caso.version,
      idempotencyKey: randomUUID(),
    })
    const anam = await abrirAnamnese(caso.id)
    const salvo = await salvarRascunho({
      anamnesisId: anam.id,
      expectedVersion: anam.version,
      blocks: responderTudo(anam.blocks),
    })
    await finalizarAnamnese({ anamnesisId: anam.id, expectedVersion: salvo.version })
    const req = await calcularParaCaso(caso.id)
    const confirmado = await confirmarRequisito({
      requirementId: req.id,
      expectedVersion: req.version,
      slotClassEscolhida: req.slotClass,
    })

    const vagas = await sugerirHorarios({ requirementId: confirmado.id, limite: 300 })
    const daSala = vagas.find((v) => v.resourceId === sala.resourceId)
    expect(daSala).toBeTruthy()
    const booking = await reservar({
      caseId: caso.id,
      requirementId: confirmado.id,
      resourceId: daSala!.resourceId,
      startsAt: daSala!.startsAt,
      idempotencyKey: randomUUID(),
    })

    // A sala fecha em todos os dias — e mesmo assim a consulta continua de pé.
    await salvarDisponibilidade({
      resourceId: sala.resourceId,
      cotas: sala.cotas,
      dias: sala.dias.map((d) => ({ ...d, ativo: false })),
    })

    const aindaExiste = await queryOne<{ status: string }>(
      `SELECT status FROM scheduling_bookings WHERE id = $1`,
      booking.id,
    )
    expect(aindaExiste?.status).toBe('CONFIRMED')
    expect(await diaDaSala(sala.resourceId, new Date(daSala!.startsAt))).toBeNull()
  })

  it('consultório novo não oferece nada até ganhar regra própria', async () => {
    const salvo = await salvarRecurso({
      nome: 'Consultório da Ala Norte',
      capabilities: ['SALA_ACESSIVEL', 'INVENTADA'],
    })
    expect(salvo.capabilities).toEqual(['SALA_ACESSIVEL'])
    expect(salvo.diasAtivos).toBe(0)
    expect((await listarRecursos()).length).toBe(4)

    const quarta = proximaSegunda()
    quarta.setDate(quarta.getDate() + 2)
    expect(await diaDaSala(salvo.id, quarta)).toBeNull()

    const disp = (await obterDisponibilidade()).find((d) => d.resourceId === salvo.id)!
    await salvarDisponibilidade({
      resourceId: salvo.id,
      cotas: { QUICK: 0, STANDARD: 100, EXTENDED: 0 },
      dias: disp.dias.map((d) =>
        d.weekday === 3 ? { ...d, ativo: true, inicio: 9 * 60, fim: 11 * 60, pausas: [] } : d,
      ),
    })

    const dia = (await diaDaSala(salvo.id, quarta))!
    expect(dia.minutosLivres).toBe(120)
    expect(capacidadeDoDia(dia).STANDARD).toBeGreaterThan(0)
    expect(capacidadeDoDia(dia).QUICK).toBe(0)
  })

  it('expediente invertido e pausa fora do expediente são recusados', async () => {
    const disp = (await obterDisponibilidade())[0]
    await expect(
      salvarDisponibilidade({
        resourceId: disp.resourceId,
        cotas: disp.cotas,
        dias: disp.dias.map((d) => (d.weekday === 2 ? { ...d, inicio: 14 * 60, fim: 9 * 60 } : d)),
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })

    await expect(
      salvarDisponibilidade({
        resourceId: disp.resourceId,
        cotas: disp.cotas,
        dias: disp.dias.map((d) =>
          d.weekday === 2 ? { ...d, pausas: [{ id: 'x', inicio: 5 * 60, fim: 6 * 60 }] } : d,
        ),
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })
  })
})

/** Responde a composição inteira, sem inventar achado clínico. */
function responderTudo(blocos: AnamnesisBlock[]): AnamnesisBlock[] {
  return blocos.map((b) => {
    const d = { ...(b.dados as Record<string, unknown>) }
    for (const [chave, valor] of Object.entries(d)) {
      if (valor && typeof valor === 'object' && 'estado' in (valor as object)) {
        d[chave] = responder(false)
      }
    }
    if (b.tipo === 'procedure_context') d.indicacao = 'Catarata'
    if (b.tipo === 'clinical_notes') d.nota = 'Sem intercorrências.'
    if (b.tipo === 'exams_pending') d.itens = [{ id: 'e1', nome: 'Hemograma', status: 'DISPONIVEL' }]
    if (b.tipo === 'vital_signs') {
      for (const c of ['sistolica', 'diastolica', 'frequenciaCardiaca', 'saturacao', 'peso', 'altura']) {
        d[c] = responder(100)
      }
    }
    if (b.tipo === 'functional_capacity') d.atividade = responder('Sobe escada')
    if (b.tipo === 'habits_substances') {
      d.tabaco = responder('NUNCA')
      d.alcool = responder('NUNCA')
    }
    if (b.tipo === 'escort_and_transport') d.formaRetorno = responder('ACOMPANHADO')
    return { ...b, dados: d }
  })
}
