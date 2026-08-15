import type { EstadoJornada, Marco, Prioridade, RegistroFila } from './tipos'

export const ESTADOS_JORNADA = [
  'cadastro_iniciado',
  'anamnese_em_andamento',
  'na_fila',
  'aguardando_no_hub',
  'em_atendimento',
  'atendido',
  'foi_embora',
] as const satisfies readonly EstadoJornada[]

const PRIORIDADES_VALIDAS: readonly Prioridade[] = [1, 2, 3, 4, null]

function assertEpochMs(valor: number): void {
  if (!Number.isFinite(valor)) {
    throw new Error('O horário da jornada deve ser um epoch ms finito')
  }
}

export function validarMarco(marco: Marco): void {
  if (!ESTADOS_JORNADA.includes(marco.estado)) {
    throw new Error(`Estado de jornada inválido: ${String(marco.estado)}`)
  }
  assertEpochMs(marco.entrouEm)
}

export function validarRegistroFila(registro: RegistroFila): void {
  if (typeof registro.id !== 'string' || registro.id.trim() === '') {
    throw new Error('O registro precisa ter um id não vazio')
  }
  if (!PRIORIDADES_VALIDAS.includes(registro.prioridade)) {
    throw new Error(`Prioridade inválida no registro ${registro.id}`)
  }
  if (!Array.isArray(registro.jornada) || registro.jornada.length === 0) {
    throw new Error(`A jornada do registro ${registro.id} não pode ser vazia`)
  }

  for (const [indice, marco] of registro.jornada.entries()) {
    validarMarco(marco)
    if (indice > 0 && marco.entrouEm < registro.jornada[indice - 1].entrouEm) {
      throw new Error(`A jornada do registro ${registro.id} não está em ordem cronológica`)
    }
  }
}

export function validarAgora(agora: number): void {
  if (!Number.isFinite(agora)) {
    throw new Error('O relógio agora deve ser um epoch ms finito')
  }
}
