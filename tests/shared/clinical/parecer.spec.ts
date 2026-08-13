import { describe, expect, it } from 'vitest'
import comorbidadesJson from '../../../src/data/catalogos/comorbidades.json'
import gruposJson from '../../../src/data/catalogos/grupos-risco.json'
import {
  gerarTextoParecer,
  resumoPaciente,
  type ComorbidadeCatalogoParecer,
} from '../../../src/shared/clinical/parecer'
import {
  classificarRisco,
  type EntradaRisco,
  type GrupoRisco,
} from '../../../src/shared/clinical/risco'

const grupos = gruposJson.itens as GrupoRisco[]
const comorbidades = comorbidadesJson.itens as ComorbidadeCatalogoParecer[]

const grave = {
  paciente: { idade: 71, sexo: 'F' },
  procedimento: { porte: 'alto' },
  comorbidades: [
    { id: 'coronariopatia', controlado: true },
    { id: 'insuficiencia-cardiaca', controlado: false },
  ],
  medicamentos: [{ id: 'm1', nome: 'Varfarina', grupo: 'anticoagulante' }],
  capacidade: { met: 2, atividade: 'Caminhar devagar' },
} satisfies EntradaRisco

describe('parecer em texto — paridade com o protótipo', () => {
  it('resume o paciente em uma linha legível', () => {
    expect(resumoPaciente(grave)).toBe('71 anos · feminino · procedimento de porte alto')
  })

  it('sem identificação, diz que não há — não inventa', () => {
    expect(resumoPaciente({ paciente: {}, procedimento: {} })).toMatch(/sem identificação/i)
  })

  it('traz rota, regras nomeadas e conduta da medicação', () => {
    const resultado = classificarRisco(grave, grupos)
    const texto = gerarTextoParecer(grave, resultado, {
      emitidoEm: '13/08/2026 09:00',
      comorbidades,
    })
    expect(texto).toContain('PARECER DE TRIAGEM PRÉ-ANESTÉSICA')
    expect(texto).toContain(resultado.rota.rotulo)
    expect(texto).toMatch(/regra: Índice de risco cardíaco/)
    expect(texto).toMatch(/Anticoagulante/)
    expect(texto).toMatch(/Definir suspensão e ponte/)
    expect(texto).toContain('13/08/2026 09:00')
  })

  it('mostra CID e o estado de controle das comorbidades', () => {
    const resultado = classificarRisco(grave, grupos)
    const texto = gerarTextoParecer(grave, resultado, { comorbidades })
    expect(texto).toMatch(/CID I20/)
    expect(texto).toMatch(/NÃO CONTROLADA/)
  })

  it('usa os CIDs clínicos corrigidos no parecer', () => {
    const entrada = {
      paciente: { idade: 42, sexo: 'F' },
      procedimento: { porte: 'baixo' },
      comorbidades: [
        { id: 'asma', controlado: true },
        { id: 'apneia-do-sono', controlado: true },
        { id: 'tabagismo', controlado: true },
      ],
      capacidade: { met: 5 },
    } satisfies EntradaRisco
    const resultado = classificarRisco(entrada, grupos)
    const texto = gerarTextoParecer(entrada, resultado, { comorbidades })

    expect(texto).toMatch(/asma \(CID J45\)/)
    expect(texto).toMatch(/apnéia do sono \(CID G47\.3\)/)
    expect(texto).toMatch(/uso do fumo \(CID F17\)/)
    expect(texto).not.toContain('CID E42')
  })

  it('quando a rota é sobreposta, registra a justificativa e a sugestão original', () => {
    const resultado = classificarRisco(grave, grupos)
    const texto = gerarTextoParecer(grave, resultado, {
      sobreposicao: 'paciente já avaliado pela cardiologia esta semana',
      comorbidades,
    })
    expect(texto).toMatch(/Decisão do profissional/)
    expect(texto).toMatch(/já avaliado pela cardiologia/)
    expect(texto).toMatch(/sugestão do sistema era/i)
  })

  it('lista pendências quando falta insumo', () => {
    const semNada = {
      paciente: {},
      procedimento: {},
      comorbidades: [],
      medicamentos: [],
      capacidade: {},
    } satisfies EntradaRisco
    const resultado = classificarRisco(semNada, grupos)
    const texto = gerarTextoParecer(semNada, resultado, { comorbidades })
    expect(texto).toMatch(/PENDÊNCIAS/)
    expect(texto).toMatch(/capacidade funcional/)
  })
})
