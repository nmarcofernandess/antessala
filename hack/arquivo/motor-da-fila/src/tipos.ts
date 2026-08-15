/** 1 é o mais urgente. null = ainda não classificado. Chega pronto de fora. */
export type Prioridade = 1 | 2 | 3 | 4 | null

export type EstadoJornada =
  | 'cadastro_iniciado'
  | 'anamnese_em_andamento'
  | 'na_fila'
  | 'aguardando_no_hub'
  | 'em_atendimento'
  | 'atendido'
  | 'foi_embora'

export interface Marco {
  estado: EstadoJornada
  /** epoch ms — quando o registro ENTROU neste estado */
  entrouEm: number
}

export interface RegistroFila {
  id: string
  prioridade: Prioridade
  /** append-only, cronológica, nunca vazia */
  jornada: Marco[]
}

export interface ItemOrdenado {
  id: string
  posicao: number
  esperaMs: number
  score: number
  /** uma linha, em português de gente, dizendo por que está nessa posição */
  motivo: string
}

export type EstadoPendente = 'cadastro_iniciado' | 'anamnese_em_andamento'

export interface ItemPendente {
  id: string
  estado: EstadoPendente
  esperaMs: number
  motivo: string
}
