import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import comorbidadesJson from '../../../src/data/catalogos/comorbidades.json'
import gruposRiscoJson from '../../../src/data/catalogos/grupos-risco.json'
import medicamentosJson from '../../../src/data/catalogos/medicamentos.json'
import metJson from '../../../src/data/catalogos/met.json'

type CidItem = {
  codigo: string
  descricao: string
}

type CidFile = {
  data: CidItem[]
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueCount(values: string[]): number {
  return new Set(values).size
}

const cid = JSON.parse(
  gunzipSync(readFileSync('src/data/catalogos/cid10.json.gz')).toString('utf8'),
) as CidFile

const descricoesCid = new Map<string, Set<string>>()
for (const item of cid.data) {
  const descricoes = descricoesCid.get(item.codigo) ?? new Set<string>()
  descricoes.add(item.descricao)
  descricoesCid.set(item.codigo, descricoes)
}

describe('integridade semântica dos catálogos clínicos', () => {
  it('mantém as 14 comorbidades ligadas a CIDs existentes e sem referências repetidas', () => {
    expect(comorbidadesJson.itens).toHaveLength(14)
    expect(uniqueCount(comorbidadesJson.itens.map((item) => item.id))).toBe(14)

    for (const item of comorbidadesJson.itens) {
      expect(item.cid.length, `${item.id} precisa ter pelo menos um CID`).toBeGreaterThan(0)
      expect(uniqueCount(item.cid.map((referencia) => referencia.codigo))).toBe(item.cid.length)

      for (const referencia of item.cid) {
        expect(
          descricoesCid.get(referencia.codigo)?.has(referencia.descricao),
          `${item.id}: ${referencia.codigo} não corresponde ao CID embarcado`,
        ).toBe(true)
      }
    }
  })

  it('preserva os vínculos clínicos explícitos das comorbidades corrigidas', () => {
    const codigosPorId = Object.fromEntries(
      comorbidadesJson.itens.map((item) => [
        item.id,
        item.cid.map((referencia) => referencia.codigo),
      ]),
    )

    expect(codigosPorId).toMatchObject({
      arritmia: ['I48'],
      dpoc: ['J44'],
      asma: ['J45'],
      'apneia-do-sono': ['G47.3'],
      anemia: ['D50'],
      hepatopatia: ['K74.6', 'K70.3'],
      tabagismo: ['F17'],
    })
  })

  it('mantém 382 medicamentos íntegros, ligados aos 12 grupos e com aliases únicos', () => {
    const grupos = new Set(gruposRiscoJson.itens.map((item) => item.id))
    const ids = medicamentosJson.itens.map((item) => item.id)

    expect(medicamentosJson.itens).toHaveLength(382)
    expect(uniqueCount(ids)).toBe(382)
    expect(grupos.size).toBe(12)

    for (const item of medicamentosJson.itens) {
      expect(item.nome.trim()).not.toBe('')
      expect(item.principio.trim()).not.toBe('')
      expect(item.classe.trim()).not.toBe('')
      expect(grupos.has(item.grupo), `${item.id}: grupo ${item.grupo} não existe`).toBe(true)
      expect(item.comerciais.length, `${item.id}: aliases vazios`).toBeGreaterThan(0)
      expect(uniqueCount(item.comerciais.map(normalize)), `${item.id}: aliases duplicados`).toBe(
        item.comerciais.length,
      )
    }

    expect(medicamentosJson.itens.reduce((total, item) => total + item.comerciais.length, 0)).toBe(
      1_447,
    )
    expect(
      medicamentosJson.itens.find((item) => item.id === 'med_102350659')?.comerciais,
    ).toContain('GLIFAGE XR')
  })

  it('mantém os 94 METs com nomes canônicos únicos e intervalos válidos', () => {
    expect(metJson.itens).toHaveLength(94)
    expect(uniqueCount(metJson.itens.map((item) => item.id))).toBe(94)
    expect(uniqueCount(metJson.itens.map((item) => normalize(item.nome)))).toBe(94)
    expect(uniqueCount(metJson.itens.map((item) => item.categoria))).toBe(20)

    for (const item of metJson.itens) {
      expect(item.nome.trim()).not.toBe('')
      expect(item.categoria.trim()).not.toBe('')
      expect(Number.isFinite(item.met)).toBe(true)
      expect(Number.isFinite(item.metMax)).toBe(true)
      expect(item.met).toBeGreaterThan(0)
      expect(item.metMax).toBeGreaterThanOrEqual(item.met)
      expect(item.nome.match(/\(/g)?.length ?? 0).toBe(item.nome.match(/\)/g)?.length ?? 0)
    }

    expect(Math.min(...metJson.itens.map((item) => item.met))).toBe(1)
    expect(Math.max(...metJson.itens.map((item) => item.metMax))).toBe(16)
    expect(metJson.itens.find((item) => item.id === 'met_item_02_yoga')?.nome).toBe('Yoga')
    expect(metJson.itens.find((item) => item.id === 'met_item_16_dirigir')?.nome).toBe('Dirigir')
    expect(metJson.itens.find((item) => item.id === 'met_item_corrida')?.nome).toBe('Correr')
  })
})
