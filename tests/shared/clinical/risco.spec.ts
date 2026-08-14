import { describe, expect, it } from 'vitest'
import gruposJson from '../../../src/data/catalogos/grupos-risco.json'
import {
  CORTES,
  classificarRisco,
  type EntradaRisco,
  type GrupoRisco,
} from '../../../src/shared/clinical/risco'

const grupos = gruposJson.itens as GrupoRisco[]

const leve = {
  paciente: { idade: 34, sexo: 'M' },
  procedimento: { porte: 'baixo' },
  comorbidades: [],
  medicamentos: [],
  capacidade: { met: 8, atividade: 'Subir escadas' },
} satisfies EntradaRisco

const grave = {
  paciente: { idade: 71, sexo: 'F' },
  procedimento: { porte: 'alto' },
  comorbidades: [
    { id: 'coronariopatia', controlado: true },
    { id: 'insuficiencia-cardiaca', controlado: false },
    { id: 'hipertensao', controlado: true },
  ],
  medicamentos: [
    { id: 'm1', nome: 'Varfarina', grupo: 'anticoagulante' },
    { id: 'm2', nome: 'Carvedilol', grupo: 'betabloqueador' },
  ],
  capacidade: { met: 2, atividade: 'Caminhada leve' },
} satisfies EntradaRisco

describe('classificarRisco — paridade histórica não aprovada', () => {
  it('caso leve sai por avaliação sucinta', () => {
    const resultado = classificarRisco(leve, grupos)
    expect(resultado.rota.id).toBe('sucinta')
    expect(resultado.estadoFisico.classe).toBe('I')
    expect(resultado.riscoCardiaco.total).toBe(0)
    expect(resultado.completo).toBe(true)
  })

  it('caso grave sai por avaliação plena', () => {
    const resultado = classificarRisco(grave, grupos)
    expect(resultado.rota.id).toBe('plena')
    expect(resultado.estadoFisico.classe).toBe('III')
    expect(resultado.riscoCardiaco.total).toBeGreaterThanOrEqual(3)
    expect(resultado.riscoCardiaco.faixa).toBe('alto')
  })

  it('anticoagulante aparece como alerta de peso alto e vem primeiro', () => {
    const resultado = classificarRisco(grave, grupos)
    expect(resultado.alertas[0].grupo).toBe('anticoagulante')
    expect(resultado.alertas[0].peso).toBe('alto')
    expect(resultado.alertas[0].conduta).not.toBe('')
  })

  it('capacidade funcional ausente vira pendência e impede rota sucinta', () => {
    const resultado = classificarRisco({ ...leve, capacidade: {} }, grupos)
    expect(resultado.pendencias.map((item) => item.campo)).toContain('capacidade funcional')
    expect(resultado.rota.id).toBe('plena')
    expect(resultado.completo).toBe(false)
  })

  it('nunca assume valor: sem porte, o campo é declarado pendente', () => {
    const resultado = classificarRisco({ ...leve, procedimento: {} }, grupos)
    expect(resultado.pendencias.map((item) => item.campo)).toContain('porte do procedimento')
  })

  it('capacidade no corte exato é adequada', () => {
    const resultado = classificarRisco(
      { ...leve, capacidade: { met: CORTES.metsAdequado } },
      grupos,
    )
    expect(resultado.capacidade.adequada).toBe(true)
    expect(resultado.rota.id).toBe('sucinta')
  })

  it('paciente leve em anticoagulante não sai por sucinta', () => {
    const resultado = classificarRisco(
      {
        ...leve,
        medicamentos: [{ id: 'm1', nome: 'Rivaroxabana', grupo: 'anticoagulante' }],
      },
      grupos,
    )
    expect(resultado.rota.id).toBe('plena')
    expect(resultado.rota.motivos.join(' ')).toMatch(/manejo perioperat/i)
  })

  it('condição pulmonar não controlada encaminha para outra especialidade', () => {
    const resultado = classificarRisco(
      { ...leve, comorbidades: [{ id: 'dpoc', controlado: false }] },
      grupos,
    )
    expect(resultado.rota.id).toBe('encaminhar')
    expect(resultado.encaminhamentos[0].especialidade).toBe('pneumologia')
  })

  it('insulina entra como critério de Lee', () => {
    const resultado = classificarRisco(
      {
        ...leve,
        medicamentos: [
          { id: 'm', nome: 'Insulina Humana NPH', grupo: 'antidiabetico' },
        ],
      },
      grupos,
    )
    expect(resultado.riscoCardiaco.criterios.map((item) => item.id)).toContain('insulina')
  })

  it('toda classificação carrega a regra que a produziu', () => {
    const resultado = classificarRisco(grave, grupos)
    expect(resultado.estadoFisico.regra.nome).toBeTruthy()
    expect(resultado.riscoCardiaco.regra.nome).toBeTruthy()
    expect(resultado.capacidade.regra.nome).toBeTruthy()
  })
})
