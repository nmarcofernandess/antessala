/**
 * Vocabulário e catálogos pequenos da superfície.
 *
 * O que existia aqui como **fila e vagas fixas saiu**: o painel, o caso e a
 * agenda leem o banco. Sobrou o vocabulário que a tela precisa para se
 * explicar — classes de vaga, rótulos de estado, a lista de procedimentos que a
 * recepção escolhe e o helper de iniciais. Nada aqui alimenta a jornada.
 */

export type ClasseVaga = 'RAPIDA' | 'NORMAL' | 'ESTENDIDA' | 'FORA_DA_FAIXA'

export const CLASSES: Record<
  ClasseVaga,
  { nome: string; minutos: number; buffer: number; tom: string; ponto: string }
> = {
  RAPIDA: {
    nome: 'Rápida',
    minutos: 20,
    buffer: 5,
    tom: 'border-success/30 bg-success/5 text-success',
    ponto: 'bg-success',
  },
  NORMAL: {
    nome: 'Normal',
    minutos: 35,
    buffer: 5,
    tom: 'border-primary/25 bg-primary/5 text-primary',
    ponto: 'bg-primary',
  },
  ESTENDIDA: {
    nome: 'Estendida',
    minutos: 50,
    buffer: 10,
    tom: 'border-warning/30 bg-warning/5 text-warning',
    ponto: 'bg-warning',
  },
  FORA_DA_FAIXA: {
    nome: 'Fora da faixa',
    minutos: 0,
    buffer: 0,
    tom: 'border-destructive/30 bg-destructive/5 text-destructive',
    ponto: 'bg-destructive',
  },
}

export type EstadoCaso =
  | 'AGUARDA_ENFERMAGEM'
  | 'EM_ENTREVISTA'
  | 'PRONTO_PARA_AGENDAR'
  | 'AGENDADO'
  | 'EM_AVALIACAO'
  | 'PENDENCIA'
  | 'CONCLUIDO'

export const ESTADOS: Record<EstadoCaso, { nome: string; tom: string }> = {
  AGUARDA_ENFERMAGEM: { nome: 'Aguarda enfermagem', tom: 'text-muted-foreground' },
  EM_ENTREVISTA: { nome: 'Em entrevista', tom: 'text-primary' },
  PRONTO_PARA_AGENDAR: { nome: 'Pronto para agendar', tom: 'text-success' },
  AGENDADO: { nome: 'Agendado', tom: 'text-foreground' },
  EM_AVALIACAO: { nome: 'Em avaliação', tom: 'text-primary' },
  PENDENCIA: { nome: 'Pendência aberta', tom: 'text-warning' },
  CONCLUIDO: { nome: 'Concluído', tom: 'text-muted-foreground' },
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/**
 * Procedimentos que a recepção pode escolher no encaminhamento.
 *
 * A lista cobre todos os casos da fila: antes faltavam dois, e o cadastro não
 * conseguia reproduzir um caso que a própria agenda exibia.
 */
export const PROCEDIMENTOS = [
  'Artroplastia de quadril', 'Osteossíntese de fêmur', 'Colecistectomia videolaparoscópica',
  'Ressecção transuretral', 'Herniorrafia inguinal', 'Artroscopia de joelho',
  'Septoplastia', 'Endoscopia digestiva alta', 'Colonoscopia diagnóstica',
  'Facectomia com implante', 'Videolaparoscopia diagnóstica',
]

