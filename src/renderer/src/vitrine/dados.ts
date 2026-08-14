/**
 * VITRINE — dados sintéticos em memória.
 *
 * Nenhum dado real de paciente. Nada aqui toca banco, IPC ou catálogo:
 * estas telas demonstram a superfície do produto sem acoplar ao runtime.
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
    tom: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
    ponto: 'bg-emerald-500',
  },
  NORMAL: {
    nome: 'Normal',
    minutos: 35,
    buffer: 5,
    tom: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400',
    ponto: 'bg-sky-500',
  },
  ESTENDIDA: {
    nome: 'Estendida',
    minutos: 50,
    buffer: 10,
    tom: 'border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400',
    ponto: 'bg-violet-500',
  },
  FORA_DA_FAIXA: {
    nome: 'Fora da faixa',
    minutos: 0,
    buffer: 0,
    tom: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    ponto: 'bg-amber-500',
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
  EM_ENTREVISTA: { nome: 'Em entrevista', tom: 'text-sky-600 dark:text-sky-400' },
  PRONTO_PARA_AGENDAR: { nome: 'Pronto para agendar', tom: 'text-emerald-600 dark:text-emerald-400' },
  AGENDADO: { nome: 'Agendado', tom: 'text-violet-600 dark:text-violet-400' },
  EM_AVALIACAO: { nome: 'Em avaliação', tom: 'text-sky-600 dark:text-sky-400' },
  PENDENCIA: { nome: 'Pendência aberta', tom: 'text-amber-600 dark:text-amber-400' },
  CONCLUIDO: { nome: 'Concluído', tom: 'text-muted-foreground' },
}

export type Caso = {
  id: string
  codigo: string
  nome: string
  idade: number
  sexo: 'F' | 'M'
  procedimento: string
  servico: string
  estado: EstadoCaso
  classe: ClasseVaga | null
  recurso: string | null
  atualizadoEm: string
  horario?: string
}

export const CASOS: Caso[] = [
  { id: 'c1', codigo: 'ANT-4A91C2', nome: 'Marta Ribeiro Alves', idade: 78, sexo: 'F',
    procedimento: 'Artroplastia de quadril', servico: 'Ortopedia', estado: 'AGENDADO',
    classe: 'ESTENDIDA', recurso: 'Sala acessível', atualizadoEm: 'há 12 min', horario: '08:00' },
  { id: 'c2', codigo: 'ANT-77B0DE', nome: 'Joaquim Nunes Prado', idade: 61, sexo: 'M',
    procedimento: 'Colecistectomia videolaparoscópica', servico: 'Cirurgia geral', estado: 'AGENDADO',
    classe: 'NORMAL', recurso: null, atualizadoEm: 'há 34 min', horario: '09:05' },
  { id: 'c3', codigo: 'ANT-1F3E88', nome: 'Helena Castro Lima', idade: 34, sexo: 'F',
    procedimento: 'Endoscopia digestiva alta', servico: 'Gastroenterologia', estado: 'AGENDADO',
    classe: 'RAPIDA', recurso: null, atualizadoEm: 'há 1 h', horario: '09:50' },
  { id: 'c4', codigo: 'ANT-9C24A7', nome: 'Sebastião Duarte Melo', idade: 69, sexo: 'M',
    procedimento: 'Herniorrafia inguinal', servico: 'Cirurgia geral', estado: 'AGENDADO',
    classe: 'NORMAL', recurso: 'Intérprete de Libras', atualizadoEm: 'há 1 h', horario: '10:20' },
  { id: 'c5', codigo: 'ANT-30D5B1', nome: 'Aparecida Gomes Fontes', idade: 72, sexo: 'F',
    procedimento: 'Facectomia com implante', servico: 'Oftalmologia', estado: 'PRONTO_PARA_AGENDAR',
    classe: 'NORMAL', recurso: 'Espaço para acompanhante', atualizadoEm: 'há 8 min' },
  { id: 'c6', codigo: 'ANT-6B8F04', nome: 'Rafael Andrade Pinto', idade: 45, sexo: 'M',
    procedimento: 'Septoplastia', servico: 'Otorrinolaringologia', estado: 'EM_ENTREVISTA',
    classe: null, recurso: null, atualizadoEm: 'agora' },
  { id: 'c7', codigo: 'ANT-2E77C9', nome: 'Luzia Barbosa Nogueira', idade: 83, sexo: 'F',
    procedimento: 'Osteossíntese de fêmur', servico: 'Ortopedia', estado: 'PENDENCIA',
    classe: 'ESTENDIDA', recurso: 'Sala acessível', atualizadoEm: 'há 2 h' },
  { id: 'c8', codigo: 'ANT-B15A63', nome: 'Cláudio Ferraz Tavares', idade: 57, sexo: 'M',
    procedimento: 'Colonoscopia diagnóstica', servico: 'Gastroenterologia', estado: 'AGUARDA_ENFERMAGEM',
    classe: null, recurso: null, atualizadoEm: 'há 5 min' },
  { id: 'c9', codigo: 'ANT-58EE0F', nome: 'Vitória Salgado Rocha', idade: 29, sexo: 'F',
    procedimento: 'Videolaparoscopia diagnóstica', servico: 'Ginecologia', estado: 'AGUARDA_ENFERMAGEM',
    classe: null, recurso: null, atualizadoEm: 'há 22 min' },
  { id: 'c10', codigo: 'ANT-C4019D', nome: 'Benedito Alencar Cruz', idade: 66, sexo: 'M',
    procedimento: 'Ressecção transuretral', servico: 'Urologia', estado: 'EM_AVALIACAO',
    classe: 'ESTENDIDA', recurso: null, atualizadoEm: 'há 3 h' },
  { id: 'c11', codigo: 'ANT-7D2B45', nome: 'Neusa Vilela Prado', idade: 74, sexo: 'F',
    procedimento: 'Artroscopia de joelho', servico: 'Ortopedia', estado: 'CONCLUIDO',
    classe: 'NORMAL', recurso: null, atualizadoEm: 'ontem' },
]

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export const SERVICOS = [
  'Ortopedia', 'Cirurgia geral', 'Gastroenterologia', 'Oftalmologia',
  'Otorrinolaringologia', 'Ginecologia', 'Urologia', 'Vascular',
]

export const PROCEDIMENTOS = [
  'Artroplastia de quadril', 'Colecistectomia videolaparoscópica', 'Endoscopia digestiva alta',
  'Herniorrafia inguinal', 'Facectomia com implante', 'Septoplastia',
  'Colonoscopia diagnóstica', 'Artroscopia de joelho', 'Ressecção transuretral',
]

/** Vagas do dia. `casoId` nulo = vaga livre. */
export type Vaga = {
  id: string
  inicio: string
  classe: ClasseVaga
  casoId: string | null
}

export const VAGAS_DO_DIA: Vaga[] = [
  { id: 'v1', inicio: '08:00', classe: 'ESTENDIDA', casoId: 'c1' },
  { id: 'v2', inicio: '09:05', classe: 'NORMAL', casoId: 'c2' },
  { id: 'v3', inicio: '09:50', classe: 'RAPIDA', casoId: 'c3' },
  { id: 'v4', inicio: '10:20', classe: 'NORMAL', casoId: 'c4' },
  { id: 'v5', inicio: '11:05', classe: 'NORMAL', casoId: null },
  { id: 'v6', inicio: '11:50', classe: 'RAPIDA', casoId: null },
  { id: 'v7', inicio: '13:30', classe: 'ESTENDIDA', casoId: null },
  { id: 'v8', inicio: '14:40', classe: 'NORMAL', casoId: null },
  { id: 'v9', inicio: '15:25', classe: 'RAPIDA', casoId: null },
]

/** Converte "HH:MM" em minutos desde a meia-noite. */
export function emMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
