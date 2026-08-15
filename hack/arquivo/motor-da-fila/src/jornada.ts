import type {
  EstadoJornada,
  ItemPendente,
  Prioridade,
  RegistroFila,
} from './tipos'
import { validarAgora, validarRegistroFila } from './validacao'

const TRANSICOES: Readonly<Record<EstadoJornada, readonly EstadoJornada[]>> = {
  cadastro_iniciado: ['anamnese_em_andamento', 'foi_embora'],
  anamnese_em_andamento: ['na_fila', 'foi_embora'],
  na_fila: ['aguardando_no_hub', 'foi_embora'],
  aguardando_no_hub: ['em_atendimento', 'foi_embora'],
  em_atendimento: ['atendido', 'foi_embora'],
  atendido: [],
  foi_embora: [],
}

const ESTADOS_COM_ESPERA: ReadonlySet<EstadoJornada> = new Set([
  'cadastro_iniciado',
  'anamnese_em_andamento',
  'na_fila',
  'aguardando_no_hub',
])

export function obterEstadoAtual(registro: RegistroFila): EstadoJornada {
  validarRegistroFila(registro)
  return registro.jornada[registro.jornada.length - 1].estado
}

export function podeTransicionar(origem: EstadoJornada, destino: EstadoJornada): boolean {
  return TRANSICOES[origem].includes(destino)
}

export function criarRegistroFila(
  id: string,
  prioridade: Prioridade,
  agora: number,
): RegistroFila {
  const registro: RegistroFila = {
    id,
    prioridade,
    jornada: [{ estado: 'cadastro_iniciado', entrouEm: agora }],
  }
  validarRegistroFila(registro)
  return registro
}

export function avancarJornada(
  registro: RegistroFila,
  destino: EstadoJornada,
  agora: number,
): RegistroFila {
  validarAgora(agora)
  validarRegistroFila(registro)
  const marcoAtual = registro.jornada[registro.jornada.length - 1]

  if (!podeTransicionar(marcoAtual.estado, destino)) {
    throw new Error(`Transição inválida: ${marcoAtual.estado} → ${destino}`)
  }
  if (agora < marcoAtual.entrouEm) {
    throw new Error('O novo marco não pode ser anterior ao estado atual')
  }

  return {
    ...registro,
    jornada: [...registro.jornada, { estado: destino, entrouEm: agora }],
  }
}

export function estadoTemEspera(estado: EstadoJornada): boolean {
  return ESTADOS_COM_ESPERA.has(estado)
}

export function obterEsperaAtualMs(registro: RegistroFila, agora: number): number | null {
  validarAgora(agora)
  validarRegistroFila(registro)
  const marcoAtual = registro.jornada[registro.jornada.length - 1]

  if (agora < marcoAtual.entrouEm) {
    throw new Error(`O relógio agora não pode ser anterior ao marco atual do registro ${registro.id}`)
  }

  return estadoTemEspera(marcoAtual.estado) ? agora - marcoAtual.entrouEm : null
}

export function listarPendencias(
  registros: readonly RegistroFila[],
  agora: number,
): ItemPendente[] {
  validarAgora(agora)

  return registros
    .map((registro) => {
      validarRegistroFila(registro)
      const marcoAtual = registro.jornada[registro.jornada.length - 1]
      if (
        marcoAtual.estado !== 'cadastro_iniciado'
        && marcoAtual.estado !== 'anamnese_em_andamento'
      ) {
        return null
      }
      const esperaMs = obterEsperaAtualMs(registro, agora) ?? 0
      const esperaMinutos = Math.floor(esperaMs / 60_000)
      return {
        id: registro.id,
        estado: marcoAtual.estado,
        esperaMs,
        entrouEm: marcoAtual.entrouEm,
        motivo: marcoAtual.estado === 'cadastro_iniciado'
          ? `Cadastro parado há ${esperaMinutos} min`
          : `Anamnese parada há ${esperaMinutos} min`,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.entrouEm - b.entrouEm || compararIds(a.id, b.id))
    .map(({ entrouEm: _entrouEm, ...item }) => item)
}

function compararIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
