import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { execute, queryOne } from '../../../src/main/db/query'
import {
  arquivarProtocolo,
  duplicarProtocolo,
  listarProtocolos,
  restaurarFixture,
  salvarProtocolo,
  seedProtocolos,
} from '../../../src/main/db/protocolos'
import { PROTOCOLOS_FIXTURE } from '../../../src/shared/protocolos'

/**
 * Persistência dos protocolos.
 *
 * O que estes testes protegem é uma promessa só: **o que o operador cadastra
 * sobrevive ao próximo boot**. A fixture nasce uma vez; a partir daí ela nunca
 * mais pisa em cima de edição humana.
 */
describe('protocolos de coleta no banco', () => {
  let dbDir: string

  beforeAll(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'antessala-protocolos-'))
    process.env.ANTESSALA_DB_PATH = dbDir
    await initDb()
    await createTables()
    await seedProtocolos()
  }, 60_000)

  afterAll(async () => {
    await closeDb()
    delete process.env.ANTESSALA_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
  })

  it('grava a fixture inteira no primeiro boot', async () => {
    const protocolos = await listarProtocolos()
    expect(protocolos).toHaveLength(PROTOCOLOS_FIXTURE.length)
    const artroplastia = protocolos.find((p) => p.id === 'artroplastia_quadril')
    expect(artroplastia?.blocos).toEqual(
      PROTOCOLOS_FIXTURE.find((p) => p.id === 'artroplastia_quadril')!.blocos,
    )
    expect(artroplastia?.origem).toBe('FIXTURE')
  })

  it('o segundo boot não pisa em cima do que a pessoa editou', async () => {
    await salvarProtocolo({
      id: 'facectomia',
      nome: 'Facectomia',
      regime: 'Ambulatorial · anestesia local',
      blocos: ['procedure_context', 'allergies'],
      procedimentos: ['Facectomia com implante'],
    })

    await seedProtocolos()

    const depois = (await listarProtocolos()).find((p) => p.id === 'facectomia')
    expect(depois?.blocos).toEqual(['procedure_context', 'allergies'])
    expect(depois?.origem).toBe('OPERADOR')
  })

  it('a versão sobe quando a composição muda, não quando só o nome muda', async () => {
    const base = await salvarProtocolo({
      nome: 'Cirurgia de teste',
      regime: 'Ambulatorial',
      blocos: ['procedure_context', 'allergies'],
      procedimentos: [],
    })
    expect(base.versao).toBe(1)

    const soNome = await salvarProtocolo({ ...base, nome: 'Cirurgia de teste renomeada' })
    expect(soNome.versao).toBe(1)

    const outraComposicao = await salvarProtocolo({
      ...soNome,
      blocos: ['procedure_context', 'allergies', 'vital_signs'],
    })
    expect(outraComposicao.versao).toBe(2)
  })

  it('recusa procedimento que já pertence a outro protocolo ativo', async () => {
    await expect(
      salvarProtocolo({
        nome: 'Outra catarata',
        regime: 'Ambulatorial',
        blocos: ['procedure_context'],
        procedimentos: ['Facectomia com implante'],
      }),
    ).rejects.toThrow(/já é atendido pelo protocolo "Facectomia"/)
  })

  it('duplica a composição sem levar os procedimentos junto', async () => {
    const copia = await duplicarProtocolo('colonoscopia')
    const original = (await listarProtocolos()).find((p) => p.id === 'colonoscopia')!
    expect(copia.blocos).toEqual(original.blocos)
    expect(copia.procedimentos).toEqual([])
    expect(copia.id).not.toBe(original.id)
  })

  it('arquiva em vez de apagar, e o geral nunca pode ser arquivado', async () => {
    await arquivarProtocolo('septoplastia')
    const ativos = await listarProtocolos()
    expect(ativos.some((p) => p.id === 'septoplastia')).toBe(false)

    const todos = await listarProtocolos({ incluirArquivados: true })
    expect(todos.some((p) => p.id === 'septoplastia')).toBe(true)

    await expect(arquivarProtocolo('geral')).rejects.toThrow(/não pode ser arquivado/)
  })

  it('o procedimento de um protocolo arquivado volta a ficar disponível', async () => {
    const reaproveitado = await salvarProtocolo({
      nome: 'Septoplastia curta',
      regime: 'Ambulatorial · anestesia geral',
      blocos: ['procedure_context', 'allergies'],
      procedimentos: ['Septoplastia'],
    })
    expect(reaproveitado.procedimentos).toEqual(['Septoplastia'])
  })

  it('restaurar o padrão devolve exatamente a fixture', async () => {
    const restaurados = await restaurarFixture()
    expect(restaurados).toHaveLength(PROTOCOLOS_FIXTURE.length)
    expect(restaurados.every((p) => p.origem === 'FIXTURE')).toBe(true)
  })

  it('a tabela recusa protocolo sem nome', async () => {
    await expect(
      execute(
        `INSERT INTO protocolos_anamnese (id, nome) VALUES ('vazio', '   ')`,
      ),
    ).rejects.toThrow()
    const sobrou = await queryOne(`SELECT id FROM protocolos_anamnese WHERE id = 'vazio'`)
    expect(sobrou).toBeUndefined()
  })
})
