import { describe, expect, it } from 'vitest'
import { ordenarFila, ordenarHub, REGRAS_ORDENACAO } from '../../../src/shared/fila'
import type { Prioridade, RegistroFila } from '../../../src/shared/fila'

const MINUTO = 60_000
const AGORA = 2_000_000_000_000

function naFila(id: string, prioridade: Prioridade, entrouEm: number): RegistroFila {
  return {
    id,
    prioridade,
    jornada: [
      { estado: 'cadastro_iniciado', entrouEm: entrouEm - 2 },
      { estado: 'anamnese_em_andamento', entrouEm: entrouEm - 1 },
      { estado: 'na_fila', entrouEm },
    ],
  }
}

function noHub(
  id: string,
  prioridade: Prioridade,
  entrouNaFilaEm: number,
  entrouNoHubEm: number,
): RegistroFila {
  return {
    id,
    prioridade,
    jornada: [
      { estado: 'cadastro_iniciado', entrouEm: entrouNaFilaEm - 2 },
      { estado: 'anamnese_em_andamento', entrouEm: entrouNaFilaEm - 1 },
      { estado: 'na_fila', entrouEm: entrouNaFilaEm },
      { estado: 'aguardando_no_hub', entrouEm: entrouNoHubEm },
    ],
  }
}

function ids(registros: ReturnType<typeof ordenarFila>): string[] {
  return registros.map((registro) => registro.id)
}

describe('ordenação da fila — oito propriedades do contrato', () => {
  it('1. Determinismo: mesma entrada e mesmo agora produzem exatamente a mesma saída', () => {
    const entrada = [
      naFila('c', 3, AGORA - 12 * MINUTO),
      naFila('a', 1, AGORA - 2 * MINUTO),
      naFila('b', null, AGORA - 46 * MINUTO),
    ]
    const retrato = structuredClone(entrada)

    const primeira = ordenarFila(entrada, AGORA)
    const segunda = ordenarFila(entrada, AGORA)

    expect(primeira).toEqual(segunda)
    expect(entrada).toEqual(retrato)
  })

  it('2. Prioridade manda: com esperas iguais, o mais urgente vem antes', () => {
    const entrouEm = AGORA - 10 * MINUTO
    const resultado = ordenarFila([
      naFila('p4', 4, entrouEm),
      naFila('p2', 2, entrouEm),
      naFila('p3', 3, entrouEm),
      naFila('p1', 1, entrouEm),
    ], AGORA)

    expect(ids(resultado)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('3. A espera pesa: prioridade 4 ultrapassa prioridade 1 nova exatamente aos 45 minutos', () => {
    expect(REGRAS_ORDENACAO.fila.minutosParaProtecao).toBe(45)

    const quase = ordenarFila([
      naFila('leve', 4, AGORA - 45 * MINUTO + 1),
      naFila('urgente', 1, AGORA),
    ], AGORA)
    expect(ids(quase)).toEqual(['urgente', 'leve'])

    const noLimite = ordenarFila([
      naFila('leve', 4, AGORA - 45 * MINUTO),
      naFila('urgente', 1, AGORA),
    ], AGORA)
    expect(ids(noLimite)).toEqual(['leve', 'urgente'])
    expect(noLimite[0].motivo).toContain('45 min')
    expect(noLimite[0].motivo).toContain('novas chegadas não passam na frente')
  })

  it('4. O urgente não monopoliza: urgentes em série não furam o leve antigo', () => {
    const inicio = AGORA
    const leve = naFila('leve-antigo', 4, inicio)
    const urgentes = Array.from({ length: 8 }, (_, indice) => {
      const minutoDeEntrada = 5 + indice * 5
      return naFila(`urgente-${minutoDeEntrada}`, 1, inicio + minutoDeEntrada * MINUTO)
    })

    const antesDaProtecao = ordenarFila([leve, ...urgentes.slice(0, 7)], inicio + 44 * MINUTO)
    expect(antesDaProtecao[0].id).toBe('urgente-5')

    const protegido = ordenarFila([leve, ...urgentes], inicio + 45 * MINUTO)
    expect(protegido[0].id).toBe('leve-antigo')
  })

  it.each<[{ prioridade: Prioridade; limite: number }]>([
    [{ prioridade: 1, limite: 45 }],
    [{ prioridade: 2, limite: 45 }],
    [{ prioridade: 3, limite: 45 }],
    [{ prioridade: 4, limite: 45 }],
    [{ prioridade: null, limite: 45 }],
  ])('5. Sem inanição: $prioridade chega à posição 1 em tempo finito', ({ prioridade, limite }) => {
    const alvo = naFila('alvo', prioridade, AGORA)
    const urgentesPosteriores = [5, 10, 20, 30, 40].map((minuto) =>
      naFila(`urgente-${minuto}`, 1, AGORA + minuto * MINUTO),
    )

    const resultado = ordenarFila([alvo, ...urgentesPosteriores], AGORA + limite * MINUTO)
    expect(resultado[0].id).toBe('alvo')
  })

  it('6. Monotonicidade: esperar mais nunca piora a posição contra um conjunto parado', () => {
    const concorrentes = [
      naFila('p1', 1, AGORA - 10 * MINUTO),
      naFila('p2', 2, AGORA - 20 * MINUTO),
      naFila('p3', 3, AGORA - 30 * MINUTO),
    ]
    const esperas = [0, 10, 20, 30, 44, 45, 60]
    const posicoes = esperas.map((espera) => {
      const resultado = ordenarFila([
        ...concorrentes,
        naFila('alvo', 4, AGORA - espera * MINUTO),
      ], AGORA)
      return resultado.find((item) => item.id === 'alvo')!.posicao
    })

    for (let indice = 1; indice < posicoes.length; indice += 1) {
      expect(posicoes[indice]).toBeLessThanOrEqual(posicoes[indice - 1])
    }
  })

  it('7. Desempate estável: entrouEm decide, nunca a ordem do array', () => {
    const antigo = naFila('z-antigo', 2, AGORA - 20 * MINUTO)
    const novo = naFila('a-novo', 2, AGORA - 10 * MINUTO)

    expect(ids(ordenarFila([novo, antigo], AGORA))).toEqual(['z-antigo', 'a-novo'])
    expect(ids(ordenarFila([antigo, novo], AGORA))).toEqual(['z-antigo', 'a-novo'])

    const mesmoHorarioA = naFila('a', 2, AGORA - 10 * MINUTO)
    const mesmoHorarioB = naFila('b', 2, AGORA - 10 * MINUTO)
    expect(ids(ordenarFila([mesmoHorarioB, mesmoHorarioA], AGORA))).toEqual(['a', 'b'])
  })

  it('8. Não classificado: entra, envelhece e alcança a posição 1', () => {
    const resultado = ordenarFila([
      naFila('urgente', 1, AGORA),
      naFila('sem-classificacao', null, AGORA - 45 * MINUTO),
    ], AGORA)

    expect(ids(resultado)).toEqual(['sem-classificacao', 'urgente'])
    expect(resultado[0].motivo).toMatch(/^Ainda sem classificação;/)
  })
})

describe('fronteiras operacionais da ordenação', () => {
  it('usa somente registros no estado correspondente e rejeita ids duplicados', () => {
    const naAnamnese: RegistroFila = {
      id: 'pendente',
      prioridade: null,
      jornada: [
        { estado: 'cadastro_iniciado', entrouEm: AGORA - 2 * MINUTO },
        { estado: 'anamnese_em_andamento', entrouEm: AGORA - MINUTO },
      ],
    }
    expect(ids(ordenarFila([naAnamnese, naFila('fila', 2, AGORA)], AGORA))).toEqual(['fila'])

    expect(() => ordenarFila([
      naFila('duplicado', 1, AGORA),
      naFila('duplicado', 2, AGORA - MINUTO),
    ], AGORA)).toThrow('Há mais de um registro com o id duplicado')
  })

  it('zera o relógio ao entrar no hub e aplica ali a proteção mais rápida de 15 minutos', () => {
    expect(REGRAS_ORDENACAO.hub.minutosParaProtecao).toBe(15)

    const acabouDeEntrar = noHub('leve', 4, AGORA - 3 * 60 * MINUTO, AGORA)
    const urgente = noHub('urgente', 1, AGORA - MINUTO, AGORA)
    expect(ids(ordenarHub([acabouDeEntrar, urgente], AGORA))).toEqual(['urgente', 'leve'])

    const leveProtegido = noHub('leve', 4, AGORA - 3 * 60 * MINUTO, AGORA - 15 * MINUTO)
    expect(ids(ordenarHub([leveProtegido, urgente], AGORA))).toEqual(['leve', 'urgente'])
    expect(ordenarHub([leveProtegido, urgente], AGORA)[0].esperaMs).toBe(15 * MINUTO)
  })

  it('produz motivos de uma linha e rejeita um relógio anterior ao marco atual', () => {
    const resultado = ordenarFila([naFila('fila', 2, AGORA - 5 * MINUTO)], AGORA)
    expect(resultado[0].motivo).not.toContain('\n')
    expect(resultado[0].motivo).not.toMatch(/score|ponderad/i)

    expect(() => ordenarFila([naFila('futuro', 1, AGORA + 1)], AGORA)).toThrow(
      'O relógio agora não pode ser anterior ao marco atual do registro futuro',
    )
  })
})
