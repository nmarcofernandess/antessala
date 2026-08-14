import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, queryOne } from '../../../src/main/db/query'
import { garantirContaSintetica } from '../../../src/main/auth/session'
import { seedProtocolos } from '../../../src/main/db/protocolos'
import {
  bloquearVaga,
  gerarVagas,
  listarRecursos,
  liberarVaga,
  removerVagasLivres,
  resumoDaOferta,
  salvarRecurso,
} from '../../../src/main/scheduling/capacity-service'
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
 * Capacidade editável.
 *
 * A oferta da agenda deixou de ser constante compilada. O que estes testes
 * protegem é a fronteira: a operação manda no consultório e no horário, mas
 * não manda em vaga que já virou compromisso com uma pessoa.
 */
describe('capacidade da agenda', () => {
  let dbDir: string

  const AMANHA = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const PLANO_BASE = {
    de: AMANHA,
    ate: AMANHA,
    diasDaSemana: [] as number[],
    blocos: [{ inicio: 8 * 60, fim: 10 * 60 }],
    mistura: ['QUICK' as const],
  }

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-capacidade-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    await initDb()
    await createTables()
    await garantirContaSintetica()
    await seedProtocolos()
    await execute(
      `INSERT INTO catalogo_servicos_solicitantes (id, nome) VALUES ('oftalmologia', 'Oftalmologia')
       ON CONFLICT (id) DO NOTHING`,
    )
  }, 90_000)

  afterAll(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  it('cria consultório com as marcas que o requisito vai consultar', async () => {
    const salvo = await salvarRecurso({
      nome: 'Consultório da Ala Norte',
      capabilities: ['SALA_ACESSIVEL', 'INVENTADA'],
    })

    expect(salvo.id).toBe('consultorio-da-ala-norte')
    // Capability desconhecida não entra: senão o requisito passaria a exigir
    // algo que nenhuma sala sabe oferecer.
    expect(salvo.capabilities).toEqual(['SALA_ACESSIVEL'])
    expect(salvo.ativo).toBe(true)

    const editado = await salvarRecurso({
      id: salvo.id,
      nome: 'Consultório Norte',
      capabilities: ['SALA_ACESSIVEL', 'APOIO_COMUNICACAO'],
      ativo: false,
    })
    expect(editado.nome).toBe('Consultório Norte')
    expect(editado.ativo).toBe(false)
    expect((await listarRecursos()).filter((r) => r.id === salvo.id)).toHaveLength(1)
  })

  it('gerar duas vezes o mesmo período não duplica vaga', async () => {
    const sala = await salvarRecurso({ nome: 'Sala de prova', capabilities: [] })

    const primeira = await gerarVagas({ ...PLANO_BASE, resourceIds: [sala.id] })
    expect(primeira.criadas).toBeGreaterThan(0)
    expect(primeira.puladas).toBe(0)

    const segunda = await gerarVagas({ ...PLANO_BASE, resourceIds: [sala.id] })
    expect(segunda.criadas).toBe(0)
    expect(segunda.puladas).toBe(primeira.criadas)

    const total = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots WHERE resource_id = $1`,
      sala.id,
    )
    expect(total?.n).toBe(primeira.criadas)
  })

  it('a duração da vaga vem da regra de dimensionamento, não da tela', async () => {
    const sala = await salvarRecurso({ nome: 'Sala de duração', capabilities: [] })
    await gerarVagas({
      ...PLANO_BASE,
      resourceIds: [sala.id],
      blocos: [{ inicio: 8 * 60, fim: 12 * 60 }],
      mistura: ['QUICK', 'STANDARD', 'EXTENDED'],
    })

    const duracoes = await queryOne<{ q: number; s: number; e: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE slot_class = 'QUICK'
           AND EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 = 20)::int AS q,
         COUNT(*) FILTER (WHERE slot_class = 'STANDARD'
           AND EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 = 35)::int AS s,
         COUNT(*) FILTER (WHERE slot_class = 'EXTENDED'
           AND EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 = 50)::int AS e
       FROM scheduling_slots WHERE resource_id = $1`,
      sala.id,
    )
    expect(duracoes?.q).toBeGreaterThan(0)
    expect(duracoes?.s).toBeGreaterThan(0)
    expect(duracoes?.e).toBeGreaterThan(0)

    const fora = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots
        WHERE resource_id = $1
          AND EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 NOT IN (20, 35, 50)`,
      sala.id,
    )
    expect(fora?.n).toBe(0)
  })

  it('recusa plano sem consultório, sem tipo de vaga ou com período invertido', async () => {
    await expect(gerarVagas({ ...PLANO_BASE, resourceIds: [] })).rejects.toMatchObject({
      codigo: 'VALIDATION_ERROR',
    })
    await expect(
      gerarVagas({ ...PLANO_BASE, resourceIds: ['sala-de-prova'], mistura: [] }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })
    await expect(
      gerarVagas({
        ...PLANO_BASE,
        resourceIds: ['sala-de-prova'],
        blocos: [{ inicio: 12 * 60, fim: 8 * 60 }],
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDATION_ERROR' })
  })

  it('limpar vagas livres preserva o que já é compromisso com alguém', async () => {
    const sala = await salvarRecurso({ nome: 'Sala com consulta', capabilities: [] })
    await gerarVagas({ ...PLANO_BASE, resourceIds: [sala.id] })

    // Um caso levado até a reserva, ocupando uma das vagas desta sala.
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
      slotClassEscolhida: 'QUICK',
    })
    const vagas = await vagasCompativeis({ requirementId: confirmado.id, limite: 200 })
    const daSala = vagas.find((v) => v.resourceId === sala.id)
    expect(daSala).toBeTruthy()
    await reservar({
      caseId: caso.id,
      requirementId: confirmado.id,
      slotId: daSala!.id,
      idempotencyKey: randomUUID(),
    })

    const r = await removerVagasLivres({ resourceId: sala.id, de: AMANHA, ate: AMANHA })
    expect(r.preservadas).toBe(1)

    const sobrou = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM scheduling_slots WHERE resource_id = $1`,
      sala.id,
    )
    expect(sobrou?.n).toBe(1)

    // E bloquear a vaga marcada é recusado: quem desmarca alguém é a agenda.
    await expect(
      bloquearVaga({ slotId: daSala!.id, motivo: 'Sala em manutenção' }),
    ).rejects.toMatchObject({ codigo: 'SLOT_TAKEN' })
  })

  it('bloquear tira a vaga da oferta e liberar devolve', async () => {
    const sala = await salvarRecurso({ nome: 'Sala de bloqueio', capabilities: [] })
    await gerarVagas({ ...PLANO_BASE, resourceIds: [sala.id] })
    const vaga = await queryOne<{ id: string }>(
      `SELECT id FROM scheduling_slots WHERE resource_id = $1 ORDER BY starts_at LIMIT 1`,
      sala.id,
    )

    await expect(bloquearVaga({ slotId: vaga!.id, motivo: 'x' })).rejects.toMatchObject({
      codigo: 'VALIDATION_ERROR',
    })

    await bloquearVaga({ slotId: vaga!.id, motivo: 'Sala emprestada para o mutirão' })
    const bloqueada = await queryOne<{ status: string; block_reason: string }>(
      `SELECT status, block_reason FROM scheduling_slots WHERE id = $1`,
      vaga!.id,
    )
    expect(bloqueada?.status).toBe('BLOCKED')
    expect(bloqueada?.block_reason).toMatch(/mutirão/)

    await liberarVaga(vaga!.id)
    const solta = await queryOne<{ status: string }>(
      `SELECT status FROM scheduling_slots WHERE id = $1`,
      vaga!.id,
    )
    expect(solta?.status).toBe('OPEN')
  })

  it('o resumo da oferta conta livres e marcadas por classe', async () => {
    const resumo = await resumoDaOferta()
    expect(resumo.porClasse.length).toBeGreaterThan(0)
    const rapidas = resumo.porClasse.find((c) => c.slotClass === 'QUICK')
    expect(rapidas!.livres + rapidas!.ocupadas).toBeGreaterThan(0)
    expect(resumo.ate).toBeTruthy()
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
    if (b.tipo === 'functional_capacity') d.atividade = responder('Sobe escada')
    if (b.tipo === 'habits_substances') {
      d.tabaco = responder('NUNCA')
      d.alcool = responder('NUNCA')
    }
    if (b.tipo === 'escort_and_transport') d.formaRetorno = responder('ACOMPANHADO')
    return { ...b, dados: d }
  })
}
