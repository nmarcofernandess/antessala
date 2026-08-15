import { describe, expect, it } from 'vitest'
import {
  avancarJornada,
  criarRegistroFila,
  estadoTemEspera,
  listarPendencias,
  obterEsperaAtualMs,
  obterEstadoAtual,
  podeTransicionar,
  validarRegistroFila,
} from '../../../src/shared/fila'
import type { EstadoJornada, RegistroFila } from '../../../src/shared/fila'

const INICIO = 2_000_000_000_000

function avancarAte(estado: EstadoJornada): RegistroFila {
  const caminho: EstadoJornada[] = [
    'anamnese_em_andamento',
    'na_fila',
    'aguardando_no_hub',
    'em_atendimento',
    'atendido',
  ]

  let registro = criarRegistroFila('registro-1', 3, INICIO)
  for (const [indice, proximo] of caminho.entries()) {
    if (obterEstadoAtual(registro) === estado) return registro
    registro = avancarJornada(registro, proximo, INICIO + indice + 1)
  }

  return registro
}

describe('máquina de estados da jornada', () => {
  it('começa no cadastro e percorre a jornada completa com um carimbo por transição', () => {
    let registro = criarRegistroFila('registro-1', 2, INICIO)

    registro = avancarJornada(registro, 'anamnese_em_andamento', INICIO + 1)
    registro = avancarJornada(registro, 'na_fila', INICIO + 2)
    registro = avancarJornada(registro, 'aguardando_no_hub', INICIO + 3)
    registro = avancarJornada(registro, 'em_atendimento', INICIO + 4)
    registro = avancarJornada(registro, 'atendido', INICIO + 5)

    expect(registro.jornada).toEqual([
      { estado: 'cadastro_iniciado', entrouEm: INICIO },
      { estado: 'anamnese_em_andamento', entrouEm: INICIO + 1 },
      { estado: 'na_fila', entrouEm: INICIO + 2 },
      { estado: 'aguardando_no_hub', entrouEm: INICIO + 3 },
      { estado: 'em_atendimento', entrouEm: INICIO + 4 },
      { estado: 'atendido', entrouEm: INICIO + 5 },
    ])
  })

  it('avança de forma imutável', () => {
    const original = criarRegistroFila('registro-1', 2, INICIO)
    const retrato = structuredClone(original)

    const avancado = avancarJornada(original, 'anamnese_em_andamento', INICIO + 1)

    expect(original).toEqual(retrato)
    expect(avancado).not.toBe(original)
    expect(avancado.jornada).not.toBe(original.jornada)
    expect(avancado.jornada).toHaveLength(2)
  })

  it('permite registrar foi embora a partir de qualquer estado ainda ativo', () => {
    const estadosAtivos: EstadoJornada[] = [
      'cadastro_iniciado',
      'anamnese_em_andamento',
      'na_fila',
      'aguardando_no_hub',
      'em_atendimento',
    ]

    for (const estado of estadosAtivos) {
      const registro = avancarAte(estado)
      const encerrado = avancarJornada(registro, 'foi_embora', INICIO + 100)
      expect(obterEstadoAtual(encerrado)).toBe('foi_embora')
    }
  })

  it('proíbe saltos, retornos, auto-transições e saídas de estados terminais', () => {
    const cadastro = criarRegistroFila('registro-1', 1, INICIO)
    expect(() => avancarJornada(cadastro, 'na_fila', INICIO + 1)).toThrow(
      'Transição inválida: cadastro_iniciado → na_fila',
    )
    expect(() => avancarJornada(cadastro, 'cadastro_iniciado', INICIO + 1)).toThrow(
      'Transição inválida: cadastro_iniciado → cadastro_iniciado',
    )

    const naFila = avancarAte('na_fila')
    expect(() => avancarJornada(naFila, 'anamnese_em_andamento', INICIO + 20)).toThrow(
      'Transição inválida: na_fila → anamnese_em_andamento',
    )

    const atendido = avancarAte('atendido')
    expect(() => avancarJornada(atendido, 'foi_embora', INICIO + 20)).toThrow(
      'Transição inválida: atendido → foi_embora',
    )
  })

  it('fecha a matriz inteira de transições, sem arestas implícitas', () => {
    const estados: EstadoJornada[] = [
      'cadastro_iniciado',
      'anamnese_em_andamento',
      'na_fila',
      'aguardando_no_hub',
      'em_atendimento',
      'atendido',
      'foi_embora',
    ]
    const permitidas: Record<EstadoJornada, EstadoJornada[]> = {
      cadastro_iniciado: ['anamnese_em_andamento', 'foi_embora'],
      anamnese_em_andamento: ['na_fila', 'foi_embora'],
      na_fila: ['aguardando_no_hub', 'foi_embora'],
      aguardando_no_hub: ['em_atendimento', 'foi_embora'],
      em_atendimento: ['atendido', 'foi_embora'],
      atendido: [],
      foi_embora: [],
    }

    for (const origem of estados) {
      for (const destino of estados) {
        expect(podeTransicionar(origem, destino), `${origem} → ${destino}`).toBe(
          permitidas[origem].includes(destino),
        )
      }
    }
  })

  it('rejeita jornada vazia, carimbo inválido e tempo regressivo com erro legível', () => {
    const vazia: RegistroFila = { id: 'vazio', prioridade: null, jornada: [] }
    expect(() => validarRegistroFila(vazia)).toThrow('A jornada do registro vazio não pode ser vazia')

    expect(() => criarRegistroFila('registro-1', 1, Number.NaN)).toThrow(
      'O horário da jornada deve ser um epoch ms finito',
    )

    const cadastro = criarRegistroFila('registro-1', 1, INICIO)
    expect(() => avancarJornada(cadastro, 'anamnese_em_andamento', INICIO - 1)).toThrow(
      'O novo marco não pode ser anterior ao estado atual',
    )

    const foraDeOrdem: RegistroFila = {
      id: 'fora-de-ordem',
      prioridade: 4,
      jornada: [
        { estado: 'cadastro_iniciado', entrouEm: INICIO },
        { estado: 'anamnese_em_andamento', entrouEm: INICIO - 1 },
      ],
    }
    expect(() => validarRegistroFila(foraDeOrdem)).toThrow(
      'A jornada do registro fora-de-ordem não está em ordem cronológica',
    )
  })

  it('faz o relógio correr somente nos quatro estados de espera', () => {
    const estadosComEspera: EstadoJornada[] = [
      'cadastro_iniciado',
      'anamnese_em_andamento',
      'na_fila',
      'aguardando_no_hub',
    ]
    const estadosSemEspera: EstadoJornada[] = ['em_atendimento', 'atendido', 'foi_embora']

    for (const estado of estadosComEspera) {
      const registro = avancarAte(estado)
      const entrouEm = registro.jornada.at(-1)!.entrouEm
      expect(estadoTemEspera(estado)).toBe(true)
      expect(obterEsperaAtualMs(registro, entrouEm + 90_000)).toBe(90_000)
    }

    for (const estado of estadosSemEspera) {
      const registro = estado === 'foi_embora'
        ? avancarJornada(criarRegistroFila('registro-1', 1, INICIO), 'foi_embora', INICIO + 1)
        : avancarAte(estado)
      expect(estadoTemEspera(estado)).toBe(false)
      expect(obterEsperaAtualMs(registro, INICIO + 90_000)).toBeNull()
    }
  })

  it('mantém cadastros e anamneses incompletos numa seção separada, mais antigo primeiro', () => {
    const cadastro = criarRegistroFila('cadastro', null, INICIO)
    const anamnese = avancarJornada(
      criarRegistroFila('anamnese', null, INICIO - 60_000),
      'anamnese_em_andamento',
      INICIO - 30_000,
    )
    const naFila = avancarJornada(
      avancarJornada(criarRegistroFila('fila', 1, INICIO - 3), 'anamnese_em_andamento', INICIO - 2),
      'na_fila',
      INICIO - 1,
    )

    const pendencias = listarPendencias([cadastro, naFila, anamnese], INICIO + 60_000)

    expect(pendencias.map((item) => item.id)).toEqual(['anamnese', 'cadastro'])
    expect(pendencias[0]).toMatchObject({
      estado: 'anamnese_em_andamento',
      esperaMs: 90_000,
    })
    expect(pendencias[0].motivo).toContain('Anamnese parada')
    expect(pendencias[1].motivo).toContain('Cadastro parado')
  })
})
