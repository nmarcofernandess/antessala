import type { AnamneseContent } from '../anamnese'

/** Pessoa descartável embutida no próprio registro; não é cadastro. */
export interface PessoaDoRegistro {
  nome: string
  sexo: string
  idade: number
  plano: string
}

/**
 * Estados persistíveis entregues pelo analyst.
 *
 * Este contrato não define transições, relógio, score ou ordenação. O motor que
 * fará isso pertence a `specs/002-motor-da-fila/`.
 */
export type EstadoJornada =
  | 'aguardando_triagem'
  | 'anamnese_em_andamento'
  | 'na_fila'
  | 'analisado_pelo_especialista'
  | 'no_hub'
  | 'encerrado'

export interface MarcoJornada {
  id: number
  registroId: string
  estado: EstadoJornada
  entrouEm: string
}

export interface RegistroAutonomo extends PessoaDoRegistro {
  id: string
  anamnese: AnamneseContent
  prioridade: 1 | 2 | 3 | 4 | null
  criadoEm: string
  atualizadoEm: string
}
