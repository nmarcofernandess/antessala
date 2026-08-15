import { describe, expect, it } from 'vitest'
import { avancarJornada, ordenarFila } from '../../../src/shared/fila'
import type { Prioridade, RegistroFila } from '../../../src/shared/fila'

const MINUTO = 60_000
const INICIO = 2_000_000_000_000

interface Cenario {
  id: string
  prioridade: Prioridade
  entrouNoMinuto: number
}

const CENARIO: Cenario[] = [
  { id: 'A', prioridade: 4, entrouNoMinuto: -30 },
  { id: 'B', prioridade: 1, entrouNoMinuto: 0 },
  { id: 'C', prioridade: 2, entrouNoMinuto: 0 },
  { id: 'D', prioridade: 3, entrouNoMinuto: 20 },
  { id: 'E', prioridade: null, entrouNoMinuto: 30 },
  { id: 'F', prioridade: 1, entrouNoMinuto: 40 },
  { id: 'G', prioridade: 4, entrouNoMinuto: 60 },
  { id: 'H', prioridade: 2, entrouNoMinuto: 80 },
  { id: 'I', prioridade: 3, entrouNoMinuto: 100 },
  { id: 'J', prioridade: null, entrouNoMinuto: 120 },
]

function criarCenario({ id, prioridade, entrouNoMinuto }: Cenario): RegistroFila {
  const entrouEm = INICIO + entrouNoMinuto * MINUTO
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

describe('simulação reproduzível de seis horas', () => {
  it('reordena sem clique e leva os dez registros à posição 1 sem deixar ninguém para trás', () => {
    const todos = CENARIO.map(criarCenario)

    const emZero = todos.filter((_, indice) => CENARIO[indice].entrouNoMinuto <= 0)
    const ordemEmZero = ordenarFila(emZero, INICIO).map((item) => item.id)
    const ordemEmQuinze = ordenarFila(emZero, INICIO + 15 * MINUTO).map((item) => item.id)
    expect(ordemEmZero).toEqual(['B', 'C', 'A'])
    expect(ordemEmQuinze).toEqual(['A', 'B', 'C'])

    let registros = todos
    const chamados: Array<{ id: string; minuto: number; esperaMinutos: number }> = []

    for (let minuto = 36; minuto <= 360; minuto += 36) {
      const agora = INICIO + minuto * MINUTO
      const disponiveis = registros.filter((registro) => registro.jornada.at(-1)!.entrouEm <= agora)
      const proximo = ordenarFila(disponiveis, agora)[0]
      expect(proximo, `deveria haver alguém para chamar no minuto ${minuto}`).toBeDefined()

      chamados.push({
        id: proximo.id,
        minuto,
        esperaMinutos: proximo.esperaMs / MINUTO,
      })
      registros = registros.map((registro) =>
        registro.id === proximo.id
          ? avancarJornada(registro, 'aguardando_no_hub', agora)
          : registro,
      )
    }

    expect(chamados).toEqual([
      { id: 'A', minuto: 36, esperaMinutos: 66 },
      { id: 'B', minuto: 72, esperaMinutos: 72 },
      { id: 'C', minuto: 108, esperaMinutos: 108 },
      { id: 'D', minuto: 144, esperaMinutos: 124 },
      { id: 'E', minuto: 180, esperaMinutos: 150 },
      { id: 'F', minuto: 216, esperaMinutos: 176 },
      { id: 'G', minuto: 252, esperaMinutos: 192 },
      { id: 'H', minuto: 288, esperaMinutos: 208 },
      { id: 'I', minuto: 324, esperaMinutos: 224 },
      { id: 'J', minuto: 360, esperaMinutos: 240 },
    ])
    expect(ordenarFila(registros, INICIO + 360 * MINUTO)).toEqual([])
  })
})
