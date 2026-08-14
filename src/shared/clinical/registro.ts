import type { AnamneseContent } from '../anamnese'

/** Snapshot do registro legado; não representa o paciente institucional canônico. */
export interface PessoaDoRegistro {
  nome: string
  sexo: string
  idade: number
  plano: string
}

/**
 * Estados persistíveis da hipótese anterior, preservados só por compatibilidade.
 *
 * Não use estes tipos como fonte do novo fluxo. A MiniSpec 001 decidirá se serão
 * mantidos, adaptados, migrados, desativados ou removidos.
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
