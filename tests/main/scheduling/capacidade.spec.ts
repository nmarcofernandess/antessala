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
  materializar,
  obterDisponibilidade,
  salvarDisponibilidade,
} from '../../../src/main/scheduling/availability-service'
import { reservar, vagasCompativeis } from '../../../src/main/scheduling/agenda-service'
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
 * A disponibilidade é a regra; as vagas são a materialização dela.
 *
 * O que estes testes protegem: mudar a regra muda a agenda inteira adiante, e
 * nunca toca no que já virou compromisso com uma pessoa.
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

  it('o primeiro boot deixa três salas com regra de dias úteis e vagas materializadas', async () => {
    const disp = await obterDisponibilidade()
    expect(disp).toHaveLength(3)

    const primeira = disp[0]
    expect(primeira.dias).toHaveLength(7)
    expect(primeira.dias[0].ativo).toBe(false) // domingo fechado
    expect(primeira.dias[1].ativo).toBe(true) // segunda aberta
    expect(primeira.dias[1].pausas).toHaveLength(1) // almoço
    expect(primeira.vagasFuturas).toBeGreaterThan(0)
  })

  it('a duração de cada vaga vem da regra de dimensionamento, nunca da tela', async () => {
    const fora = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots
        WHERE EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 NOT IN (20, 35, 50)`,
    )
    expect(fora?.n).toBe(0)
  })

  it('nenhuma vaga nasce dentro da pausa do expediente', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[0]
    const pausa = sala.dias[1].pausas[0]

    // A conta é feita no fuso local, como a tela lê — `EXTRACT` no banco
    // devolveria hora UTC e a comparação viraria mentira.
    const vagas = await queryAll<{ starts_at: string }>(
      `SELECT starts_at FROM scheduling_slots WHERE resource_id = $1`,
      sala.resourceId,
    )
    const dentroDaPausa = vagas.filter((v) => {
      const d = new Date(v.starts_at)
      if (d.getDay() !== 1) return false
      const min = d.getHours() * 60 + d.getMinutes()
      return min >= pausa.inicio && min < pausa.fim
    })
    expect(dentroDaPausa).toHaveLength(0)
  })

  it('materializar de novo não duplica nem apaga nada', async () => {
    const disp = await obterDisponibilidade()
    const antes = disp[0].vagasFuturas
    const r = await materializar(disp[0].resourceId)
    expect(r.criadas).toBe(0)
    expect(r.removidas).toBe(0)
    expect((await obterDisponibilidade())[0].vagasFuturas).toBe(antes)
  })

  it('mudar a regra reconcilia a agenda adiante', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[0]

    // Sábado passa a abrir; a segunda encolhe para meio período.
    const dias = sala.dias.map((d) => {
      if (d.weekday === 6) return { ...d, ativo: true, inicio: 8 * 60, fim: 12 * 60, pausas: [] }
      if (d.weekday === 1) return { ...d, fim: 12 * 60, pausas: [] }
      return d
    })
    const r = await salvarDisponibilidade({
      resourceId: sala.resourceId,
      mistura: sala.mistura,
      dias,
    })
    expect(r.criadas).toBeGreaterThan(0) // sábados
    expect(r.removidas).toBeGreaterThan(0) // tardes de segunda

    const vagas = await queryAll<{ starts_at: string }>(
      `SELECT starts_at FROM scheduling_slots WHERE resource_id = $1 AND starts_at >= NOW()`,
      sala.resourceId,
    )
    const tardeDeSegunda = vagas.filter((v) => {
      const d = new Date(v.starts_at)
      return d.getDay() === 1 && d.getHours() >= 13
    })
    expect(tardeDeSegunda).toHaveLength(0)

    const sabados = vagas.filter((v) => new Date(v.starts_at).getDay() === 6)
    expect(sabados.length).toBeGreaterThan(0)
  })

  it('a mistura escolhida é a única que aparece na agenda daquela sala', async () => {
    const disp = await obterDisponibilidade()
    const sala = disp[1]
    await salvarDisponibilidade({
      resourceId: sala.resourceId,
      mistura: ['QUICK'],
      dias: sala.dias,
    })

    const outras = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots
        WHERE resource_id = $1 AND slot_class <> 'QUICK' AND starts_at >= NOW()`,
      sala.resourceId,
    )
    expect(outras?.n).toBe(0)

    await expect(
      salvarDisponibilidade({ resourceId: sala.resourceId, mistura: [], dias: sala.dias }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })
  })

  it('a vaga com consulta marcada sobrevive à mudança de regra', async () => {
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

    const vagas = await vagasCompativeis({ requirementId: confirmado.id, limite: 300 })
    const daSala = vagas.find((v) => v.resourceId === sala.resourceId)
    expect(daSala).toBeTruthy()
    await reservar({
      caseId: caso.id,
      requirementId: confirmado.id,
      slotId: daSala!.id,
      idempotencyKey: randomUUID(),
    })

    // A sala fecha em todos os dias — e mesmo assim a consulta continua de pé.
    await salvarDisponibilidade({
      resourceId: sala.resourceId,
      mistura: sala.mistura,
      dias: sala.dias.map((d) => ({ ...d, ativo: false })),
    })

    const aindaExiste = await queryOne<{ id: string }>(
      `SELECT id FROM scheduling_slots WHERE id = $1`,
      daSala!.id,
    )
    expect(aindaExiste?.id).toBe(daSala!.id)

    const livresDaSala = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots s
        WHERE s.resource_id = $1 AND s.starts_at >= NOW()
          AND NOT EXISTS (SELECT 1 FROM scheduling_bookings b WHERE b.slot_id = s.id)`,
      sala.resourceId,
    )
    expect(livresDaSala?.n).toBe(0)
  })

  it('consultório novo entra sem vaga até ganhar regra própria', async () => {
    const salvo = await salvarRecurso({
      nome: 'Consultório da Ala Norte',
      capabilities: ['SALA_ACESSIVEL', 'INVENTADA'],
    })
    expect(salvo.capabilities).toEqual(['SALA_ACESSIVEL'])
    expect(salvo.vagasFuturas).toBe(0)
    expect((await listarRecursos()).length).toBe(4)

    const disp = (await obterDisponibilidade()).find((d) => d.resourceId === salvo.id)!
    await salvarDisponibilidade({
      resourceId: salvo.id,
      mistura: ['STANDARD'],
      dias: disp.dias.map((d) =>
        d.weekday === 3 ? { ...d, ativo: true, inicio: 9 * 60, fim: 11 * 60, pausas: [] } : d,
      ),
    })

    const criadas = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots WHERE resource_id = $1`,
      salvo.id,
    )
    expect(criadas?.n).toBeGreaterThan(0)
  })

  it('expediente invertido e pausa fora do expediente são recusados', async () => {
    const disp = (await obterDisponibilidade())[0]
    await expect(
      salvarDisponibilidade({
        resourceId: disp.resourceId,
        mistura: ['QUICK'],
        dias: disp.dias.map((d) =>
          d.weekday === 2 ? { ...d, inicio: 14 * 60, fim: 9 * 60 } : d,
        ),
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })

    await expect(
      salvarDisponibilidade({
        resourceId: disp.resourceId,
        mistura: ['QUICK'],
        dias: disp.dias.map((d) =>
          d.weekday === 2
            ? { ...d, pausas: [{ id: 'x', inicio: 5 * 60, fim: 6 * 60 }] }
            : d,
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
