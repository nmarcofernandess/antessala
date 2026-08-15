import { obterEstadoAtual, obterEsperaAtualMs } from './jornada'
import type {
  EstadoJornada,
  ItemOrdenado,
  Prioridade,
  RegistroFila,
} from './tipos'
import { validarAgora, validarRegistroFila } from './validacao'

/**
 * A regra cabe numa conversa de recepção:
 *
 * - antes da proteção, a prioridade clínica manda e, dentro da mesma prioridade,
 *   chama-se quem entrou primeiro;
 * - ao completar 45 minutos na fila, ninguém que chegou depois pode passar na frente;
 * - no hub o mesmo freio entra em 15 minutos, porque ali a pessoa já foi chamada uma vez.
 *
 * O score apenas codifica essa frase para ordenar. A faixa protegida fica acima da faixa
 * clínica; dentro dela, cada ms de espera conta. As constantes são políticas operacionais,
 * não cálculo de risco: a prioridade chega pronta de fora e nunca é inferida aqui.
 */
export const REGRAS_ORDENACAO = {
  fila: { minutosParaProtecao: 45 },
  hub: { minutosParaProtecao: 15 },
  pontosFaixaProtegida: 10,
  pontosPrioridade: {
    1: 4,
    2: 3,
    3: 2,
    4: 1,
    naoClassificado: 0,
  },
} as const

interface ConfiguracaoOrdenacao {
  estado: EstadoJornada
  minutosParaProtecao: number
  nomeDaEspera: 'fila' | 'hub'
}

interface ItemInterno extends ItemOrdenado {
  entrouEm: number
  protegido: boolean
  prioridade: Prioridade
}

export function ordenarFila(
  registros: readonly RegistroFila[],
  agora: number,
): ItemOrdenado[] {
  return ordenar(registros, agora, {
    estado: 'na_fila',
    minutosParaProtecao: REGRAS_ORDENACAO.fila.minutosParaProtecao,
    nomeDaEspera: 'fila',
  })
}

export function ordenarHub(
  registros: readonly RegistroFila[],
  agora: number,
): ItemOrdenado[] {
  return ordenar(registros, agora, {
    estado: 'aguardando_no_hub',
    minutosParaProtecao: REGRAS_ORDENACAO.hub.minutosParaProtecao,
    nomeDaEspera: 'hub',
  })
}

function ordenar(
  registros: readonly RegistroFila[],
  agora: number,
  configuracao: ConfiguracaoOrdenacao,
): ItemOrdenado[] {
  validarAgora(agora)
  validarIdsUnicos(registros)

  const itens: ItemInterno[] = registros.flatMap((registro) => {
    validarRegistroFila(registro)
    if (obterEstadoAtual(registro) !== configuracao.estado) return []

    const marcoAtual = registro.jornada[registro.jornada.length - 1]
    const esperaMs = obterEsperaAtualMs(registro, agora) ?? 0
    const limiteMs = configuracao.minutosParaProtecao * 60_000
    const protegido = esperaMs >= limiteMs
    const pontosPrioridade = obterPontosPrioridade(registro.prioridade)
    const score = protegido
      ? REGRAS_ORDENACAO.pontosFaixaProtegida + esperaMs
      : pontosPrioridade

    return [{
      id: registro.id,
      posicao: 0,
      esperaMs,
      score,
      motivo: criarMotivo(
        registro.prioridade,
        esperaMs,
        protegido,
        configuracao.minutosParaProtecao,
        configuracao.nomeDaEspera,
      ),
      entrouEm: marcoAtual.entrouEm,
      protegido,
      prioridade: registro.prioridade,
    }]
  })

  itens.sort(compararItens)

  return itens.map(({
    entrouEm: _entrouEm,
    protegido: _protegido,
    prioridade: _prioridade,
    ...item
  }, indice) => ({
    ...item,
    posicao: indice + 1,
  }))
}

function compararItens(a: ItemInterno, b: ItemInterno): number {
  if (a.protegido !== b.protegido) return a.protegido ? -1 : 1
  if (!a.protegido && a.prioridade !== b.prioridade) {
    const diferenca = obterPontosPrioridade(b.prioridade) - obterPontosPrioridade(a.prioridade)
    if (diferenca !== 0) return diferenca
  }
  if (a.entrouEm !== b.entrouEm) return a.entrouEm - b.entrouEm
  return compararIds(a.id, b.id)
}

function obterPontosPrioridade(prioridade: Prioridade): number {
  return prioridade === null
    ? REGRAS_ORDENACAO.pontosPrioridade.naoClassificado
    : REGRAS_ORDENACAO.pontosPrioridade[prioridade]
}

function criarMotivo(
  prioridade: Prioridade,
  esperaMs: number,
  protegido: boolean,
  minutosParaProtecao: number,
  nomeDaEspera: 'fila' | 'hub',
): string {
  const esperaMinutos = Math.floor(esperaMs / 60_000)
  const prefixo = prioridade === null
    ? 'Ainda sem classificação'
    : `Prioridade ${prioridade}`

  if (protegido) {
    return `${prefixo}; espera de ${esperaMinutos} min atingiu a proteção de ${minutosParaProtecao} min: novas chegadas não passam na frente`
  }

  return `${prefixo}; há ${esperaMinutos} min no ${nomeDaEspera}`
}

function validarIdsUnicos(registros: readonly RegistroFila[]): void {
  const ids = new Set<string>()
  for (const registro of registros) {
    if (ids.has(registro.id)) {
      throw new Error(`Há mais de um registro com o id ${registro.id}`)
    }
    ids.add(registro.id)
  }
}

function compararIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
