/**
 * Onde os protocolos moram, do ponto de vista da tela.
 *
 * Duas verdades possíveis, e a diferença é honesta na interface:
 *
 * - **No app** existe banco. A lista vem de `protocolos_anamnese`, toda edição
 *   é gravada e sobrevive ao fechar. É o estado do app empacotado.
 * - **Fora do Electron** — vitrine no navegador, testes — não há banco. A
 *   fixture compilada é a lista, e a edição vale enquanto a aba estiver aberta.
 *   A tela avisa; não finge persistir o que vai evaporar.
 *
 * O store é módulo, não contexto React, porque a lista é uma só para o app
 * inteiro: o cadastro precisa dela para dizer qual entrevista o procedimento
 * abre, a anamnese para montar os blocos, a configuração para editar.
 */

import { useSyncExternalStore } from 'react'
import { client, temPersistencia } from '@/servicos/client'
import {
  ID_PROTOCOLO_GERAL,
  PROTOCOLOS_FIXTURE,
  protocoloPara as escolherNaLista,
  type Protocolo,
} from '@shared/protocolos'

export type EntradaProtocolo = {
  id?: string
  nome: string
  regime: string
  blocos: string[]
  procedimentos: string[]
}

type Estado = {
  protocolos: Protocolo[]
  carregando: boolean
  erro: string | null
}

let estado: Estado = {
  protocolos: PROTOCOLOS_FIXTURE.map((p) => ({ ...p })),
  carregando: temPersistencia,
  erro: null,
}

const ouvintes = new Set<() => void>()

function definir(parcial: Partial<Estado>): void {
  estado = { ...estado, ...parcial }
  for (const ouvinte of ouvintes) ouvinte()
}

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

function mensagem(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

let carregou = false

/** Carrega do banco uma vez por sessão. Sem banco, a fixture já está no estado. */
export async function carregarProtocolos(forcar = false): Promise<void> {
  if (!temPersistencia) return
  if (carregou && !forcar) return
  carregou = true
  definir({ carregando: true, erro: null })
  try {
    const protocolos = await client['protocolos.listar']({})
    definir({ protocolos, carregando: false })
  } catch (erro) {
    // Perder o banco não pode apagar a tela: a fixture continua respondendo.
    definir({ carregando: false, erro: mensagem(erro) })
  }
}

/* ══════════════ escrita ══════════════ */

function ordenar(lista: Protocolo[]): Protocolo[] {
  return [...lista].sort((a, b) => {
    if (a.id === ID_PROTOCOLO_GERAL) return 1
    if (b.id === ID_PROTOCOLO_GERAL) return -1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

function idDoNome(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || 'protocolo'
  )
}

/** Mesma regra do main, para a sessão sem banco recusar o mesmo que o banco recusa. */
function recusarProcedimentoJaUsado(id: string | undefined, procedimentos: string[]): void {
  for (const proc of procedimentos) {
    const dono = estado.protocolos.find(
      (p) =>
        p.id !== id &&
        !p.arquivadoEm &&
        p.procedimentos.some((x) => x.trim().toLowerCase() === proc.trim().toLowerCase()),
    )
    if (dono) {
      throw new Error(
        `"${proc}" já é atendido pelo protocolo "${dono.nome}". Remova de lá antes de usar aqui.`,
      )
    }
  }
}

export async function salvarProtocolo(entrada: EntradaProtocolo): Promise<Protocolo> {
  const nome = entrada.nome.trim()
  if (!nome) throw new Error('O protocolo precisa de um nome.')
  const blocos = [...new Set(entrada.blocos)]
  const procedimentos = [...new Set(entrada.procedimentos.map((p) => p.trim()).filter(Boolean))]

  if (temPersistencia) {
    const salvo = await client['protocolos.salvar']({ ...entrada, nome, blocos, procedimentos })
    const restantes = estado.protocolos.filter((p) => p.id !== salvo.id)
    definir({ protocolos: ordenar([...restantes, salvo]) })
    return salvo
  }

  recusarProcedimentoJaUsado(entrada.id, procedimentos)
  const anterior = entrada.id ? estado.protocolos.find((p) => p.id === entrada.id) : undefined
  const composicaoMudou = !anterior || anterior.blocos.join('|') !== blocos.join('|')
  const salvo: Protocolo = {
    id: anterior?.id ?? idLivreNaSessao(idDoNome(nome)),
    nome,
    regime: entrada.regime.trim(),
    blocos,
    procedimentos,
    versao: anterior ? anterior.versao + (composicaoMudou ? 1 : 0) : 1,
    origem: 'OPERADOR',
    arquivadoEm: null,
  }
  const restantes = estado.protocolos.filter((p) => p.id !== salvo.id)
  definir({ protocolos: ordenar([...restantes, salvo]) })
  return salvo
}

function idLivreNaSessao(base: string): string {
  let candidato = base
  let n = 1
  while (estado.protocolos.some((p) => p.id === candidato)) candidato = `${base}_${++n}`
  return candidato
}

export async function duplicarProtocolo(id: string): Promise<Protocolo> {
  const origem = estado.protocolos.find((p) => p.id === id)
  if (!origem) throw new Error('Protocolo não encontrado.')
  if (temPersistencia) {
    const copia = await client['protocolos.duplicar']({ id })
    definir({ protocolos: ordenar([...estado.protocolos, copia]) })
    return copia
  }
  return salvarProtocolo({
    nome: `${origem.nome} (cópia)`,
    regime: origem.regime,
    blocos: origem.blocos,
    procedimentos: [],
  })
}

export async function arquivarProtocolo(id: string): Promise<void> {
  if (id === ID_PROTOCOLO_GERAL) {
    throw new Error('O protocolo geral é o fallback do sistema e não pode ser arquivado.')
  }
  if (temPersistencia) await client['protocolos.arquivar']({ id })
  definir({ protocolos: estado.protocolos.filter((p) => p.id !== id) })
}

export async function restaurarFixture(): Promise<void> {
  if (temPersistencia) {
    const protocolos = await client['protocolos.restaurarFixture']()
    definir({ protocolos })
    return
  }
  definir({ protocolos: PROTOCOLOS_FIXTURE.map((p) => ({ ...p })) })
}

/* ══════════════ leitura ══════════════ */

export function useProtocolos(): Estado & { persistente: boolean } {
  const atual = useSyncExternalStore(inscrever, () => estado)
  return { ...atual, persistente: temPersistencia }
}

/** O protocolo que o procedimento aplica, segundo a lista viva. */
export function useProtocoloDe(procedimento: string | undefined): Protocolo {
  const { protocolos } = useProtocolos()
  return escolherNaLista(procedimento, protocolos)
}

/** Leitura fora de componente — usada por quem monta blocos sob demanda. */
export function protocoloAtualDe(procedimento: string | undefined): Protocolo {
  return escolherNaLista(procedimento, estado.protocolos)
}

/** Só para teste: devolve o store ao estado de nascimento. */
export function resetarStoreDeProtocolos(): void {
  carregou = false
  estado = {
    protocolos: PROTOCOLOS_FIXTURE.map((p) => ({ ...p })),
    carregando: false,
    erro: null,
  }
  for (const ouvinte of ouvintes) ouvinte()
}
