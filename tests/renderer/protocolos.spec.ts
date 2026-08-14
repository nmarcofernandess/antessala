import { describe, expect, it } from 'vitest'
import {
  PROTOCOLOS,
  PROTOCOLO_GERAL,
  acrescentarFaltantes,
  aplicar,
  protocoloPara,
} from '../../src/renderer/src/vitrine/widgets/protocolos'
import { WIDGETS, widgetPorTipo } from '../../src/renderer/src/vitrine/widgets/registro'
import { calcularRequisito } from '../../src/renderer/src/vitrine/widgets/requisito'
import { PROCEDIMENTOS } from '../../src/renderer/src/vitrine/dados'

describe('protocolos por procedimento', () => {
  it('todo bloco de todo protocolo existe no registro de widgets', () => {
    for (const p of [...PROTOCOLOS, PROTOCOLO_GERAL]) {
      for (const tipo of p.blocos) {
        expect(widgetPorTipo(tipo), `${p.id} pede "${tipo}", que não existe`).toBeDefined()
      }
    }
  })

  it('nenhum protocolo repete um bloco', () => {
    for (const p of [...PROTOCOLOS, PROTOCOLO_GERAL]) {
      expect(new Set(p.blocos).size, `${p.id} repete bloco`).toBe(p.blocos.length)
    }
  })

  it('todo procedimento oferecido no cadastro tem protocolo próprio', () => {
    for (const proc of PROCEDIMENTOS) {
      expect(protocoloPara(proc).id, `"${proc}" caiu no fallback`).not.toBe('geral')
    }
  })

  it('procedimento desconhecido ou ausente cai no protocolo geral', () => {
    expect(protocoloPara('Cirurgia que não existe no catálogo').id).toBe('geral')
    expect(protocoloPara(undefined).id).toBe('geral')
    expect(protocoloPara('').id).toBe('geral')
  })

  it('encontra o protocolo sem depender de caixa ou espaço', () => {
    expect(protocoloPara('  facectomia COM implante  ').id).toBe('facectomia')
  })

  it('o protocolo geral cobre todos os widgets do registro', () => {
    expect(new Set(PROTOCOLO_GERAL.blocos)).toEqual(new Set(WIDGETS.map((w) => w.tipo)))
  })

  it('a facectomia coleta bem menos que a artroplastia', () => {
    const local = protocoloPara('Facectomia com implante')
    const internacao = protocoloPara('Artroplastia de quadril')
    expect(local.blocos.length).toBeLessThan(internacao.blocos.length)
  })
})

describe('aplicar', () => {
  it('materializa exatamente os blocos do protocolo, na ordem', () => {
    const p = protocoloPara('Endoscopia digestiva alta')
    expect(aplicar(p).map((b) => b.tipo)).toEqual(p.blocos)
  })

  it('gera identificadores novos a cada aplicação', () => {
    const p = protocoloPara('Facectomia com implante')
    const ids = [...aplicar(p), ...aplicar(p)].map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dá dados próprios a cada bloco, sem compartilhar referência', () => {
    const p = protocoloPara('Facectomia com implante')
    const a = aplicar(p)[0]
    const b = aplicar(p)[0]
    expect(a.dados).not.toBe(b.dados)
  })
})

describe('acrescentarFaltantes', () => {
  it('traz só o que ainda não está no caso e preserva o que existe', () => {
    const enxuto = protocoloPara('Facectomia com implante')
    const completo = protocoloPara('Artroplastia de quadril')

    const atuais = aplicar(enxuto)
    const depois = acrescentarFaltantes(completo, atuais)

    // Nada do que já existia foi trocado.
    expect(depois.slice(0, atuais.length)).toEqual(atuais)
    // Todo bloco do protocolo novo passou a estar presente.
    for (const tipo of completo.blocos) {
      expect(depois.some((b) => b.tipo === tipo)).toBe(true)
    }
    // E nenhum tipo ficou duplicado.
    const tipos = depois.map((b) => b.tipo)
    expect(new Set(tipos).size).toBe(tipos.length)
  })
})

describe('completude segue a composição aplicada', () => {
  it('um caso montado pelo protocolo não tem pendência', () => {
    const p = protocoloPara('Artroplastia de quadril')
    expect(calcularRequisito(aplicar(p), p).pendentes).toEqual([])
  })

  it('bloco do protocolo removido do caso vira pendência', () => {
    const p = protocoloPara('Artroplastia de quadril')
    const semAlergias = aplicar(p).filter((b) => b.tipo !== 'allergies')

    const { pendentes } = calcularRequisito(semAlergias, p)
    expect(pendentes).toContain(widgetPorTipo('allergies')!.nome)
  })

  it('bloco fora do protocolo é complementar e nunca bloqueia a publicação', () => {
    const enxuto = protocoloPara('Facectomia com implante')
    const blocos = aplicar(enxuto)

    // Acrescenta um bloco que o protocolo da facectomia não pede.
    const extra = widgetPorTipo('habits_substances')!
    blocos.push({ id: 'extra_1', tipo: extra.tipo, dados: extra.dadosIniciais() })

    expect(calcularRequisito(blocos, enxuto).pendentes).toEqual([])
  })

  it('bloco complementar não tratado também não bloqueia', () => {
    const enxuto = protocoloPara('Facectomia com implante')
    const blocos = aplicar(enxuto)

    // Condições especiais nasce sem tratamento quando zerado à mão.
    blocos.push({
      id: 'extra_2',
      tipo: 'special_conditions',
      dados: { gestante: { estado: 'NAO_PERGUNTADO' }, lactante: { estado: 'NAO_PERGUNTADO' } },
    })

    expect(calcularRequisito(blocos, enxuto).pendentes).toEqual([])
  })

  it('o requisito da facectomia é menor que o da artroplastia', () => {
    const local = protocoloPara('Facectomia com implante')
    const internacao = protocoloPara('Artroplastia de quadril')

    const menor = calcularRequisito(aplicar(local), local)
    const maior = calcularRequisito(aplicar(internacao), internacao)

    expect(menor.minutos).toBeLessThan(maior.minutos)
  })

  it('o cálculo de minutos da artroplastia continua em 50, vaga estendida', () => {
    const p = protocoloPara('Artroplastia de quadril')
    const r = calcularRequisito(aplicar(p), p)

    expect(r.minutos).toBe(50)
    expect(r.classe).toBe('ESTENDIDA')
  })

  it('o teto de três domínios continua valendo', () => {
    const p = protocoloPara('Artroplastia de quadril')
    const { sinais } = calcularRequisito(aplicar(p), p)

    expect(sinais.filter((s) => s.minutos === 5 && !s.noTeto).length).toBeLessThanOrEqual(5)
    expect(sinais.some((s) => s.noTeto)).toBe(true)
  })
})
