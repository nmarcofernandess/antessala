/**
 * VITRINE — acesso aos catálogos clínicos reais.
 *
 * Nada aqui é inventado: os arquivos vêm de `src/data/catalogos/`, os mesmos
 * que o main carrega no seed. O renderer lê a versão estática para que a busca
 * dos widgets funcione sem ida ao processo principal.
 */

import medicamentosRaw from '../../../data/catalogos/medicamentos.json'
import cid10Raw from '../../../data/catalogos/cid10-categorias.json'
import metRaw from '../../../data/catalogos/met.json'
import comorbidadesRaw from '../../../data/catalogos/comorbidades.json'

/* ══════════════ medicamentos ══════════════ */

export type Medicamento = {
  id: string
  nome: string
  principio: string
  comerciais: string[]
  classe: string
  grupo: string
}

export const MEDICAMENTOS: Medicamento[] = medicamentosRaw.itens

/** Classes terapêuticas presentes no catálogo, com contagem real. */
export const CLASSES_MEDICAMENTO: { classe: string; total: number }[] = Object.entries(
  MEDICAMENTOS.reduce<Record<string, number>>((acc, m) => {
    acc[m.classe] = (acc[m.classe] ?? 0) + 1
    return acc
  }, {}),
)
  .map(([classe, total]) => ({ classe, total }))
  .sort((a, b) => b.total - a.total)

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Busca por princípio ativo ou nome comercial. O catálogo guarda 1.447 apelidos
 * comerciais, então "Glifage" precisa encontrar "Cloridrato de Metformina".
 */
export function buscarMedicamento(termo: string, limite = 8): Medicamento[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []

  const pontuar = (m: Medicamento): number => {
    const nome = semAcento(m.nome)
    if (nome.startsWith(t)) return 100
    if (nome.includes(t)) return 70
    const comercial = m.comerciais.find((c) => semAcento(c).startsWith(t))
    if (comercial) return 60
    if (m.comerciais.some((c) => semAcento(c).includes(t))) return 40
    if (semAcento(m.classe).includes(t)) return 20
    return 0
  }

  return MEDICAMENTOS.map((m) => ({ m, p: pontuar(m) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.m.nome.length - b.m.nome.length)
    .slice(0, limite)
    .map((x) => x.m)
}

/** Nome comercial que justificou o resultado — mostrado como pista na busca. */
export function comercialQueBate(m: Medicamento, termo: string): string | null {
  const t = semAcento(termo.trim())
  if (t.length < 2) return null
  if (semAcento(m.nome).includes(t)) return null
  return m.comerciais.find((c) => semAcento(c).includes(t)) ?? null
}

/* ══════════════ CID-10 ══════════════ */

export type CidCategoria = {
  codigo: string
  descricao: string
  capitulo: string
  termos: string[]
  score: number
}

export const CID10: CidCategoria[] = cid10Raw.itens

/** Busca por código, descrição ou termo popular ("dm2" acha E11). */
export function buscarCid(termo: string, limite = 8): CidCategoria[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []

  const pontuar = (c: CidCategoria): number => {
    if (semAcento(c.codigo) === t) return 200
    if (semAcento(c.codigo).startsWith(t)) return 150
    if (c.termos.some((x) => semAcento(x) === t)) return 120
    const desc = semAcento(c.descricao)
    if (desc.startsWith(t)) return 90
    if (c.termos.some((x) => semAcento(x).startsWith(t))) return 80
    if (desc.includes(t)) return 50
    return 0
  }

  return CID10.map((c) => ({ c, p: pontuar(c) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || b.c.score - a.c.score)
    .slice(0, limite)
    .map((x) => x.c)
}

/* ══════════════ MET e comorbidades ══════════════ */

export type AtividadeMet = {
  id: string
  nome: string
  categoria: string
  met: number
  metMax?: number
}

export const ATIVIDADES_MET: AtividadeMet[] = metRaw.itens

export function buscarAtividade(termo: string, limite = 8): AtividadeMet[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []
  return ATIVIDADES_MET.filter(
    (a) => semAcento(a.nome).includes(t) || semAcento(a.categoria).includes(t),
  )
    .sort((a, b) => a.met - b.met)
    .slice(0, limite)
}

export type Comorbidade = {
  id: string
  rotulo: string
  cid: { codigo: string; descricao: string }[]
}

export const COMORBIDADES: Comorbidade[] = comorbidadesRaw.itens

/** Números reais dos catálogos — usados no rodapé da tela, sem arredondar. */
export const TAMANHO_CATALOGOS = {
  medicamentos: MEDICAMENTOS.length,
  comerciais: MEDICAMENTOS.reduce((s, m) => s + m.comerciais.length, 0),
  classes: CLASSES_MEDICAMENTO.length,
  cid: CID10.length,
  met: ATIVIDADES_MET.length,
  comorbidades: COMORBIDADES.length,
}
