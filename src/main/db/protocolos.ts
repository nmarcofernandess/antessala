/**
 * Repositório dos protocolos de coleta.
 *
 * O primeiro boot grava a fixture e nunca mais volta a escrevê-la: a partir daí
 * a verdade é a tabela, porque o operador edita as composições na tela. Por isso
 * o seed é `ON CONFLICT DO NOTHING` — ao contrário dos catálogos clínicos, que
 * são substituídos a cada revisão de asset, aqui sobrescrever apagaria trabalho
 * humano.
 *
 * Nada neste arquivo interpreta clinicamente a composição. Um protocolo é a
 * lista de perguntas que o formulário faz; quem decide se um bloco existe é o
 * registro de widgets do renderer, e quem decide o que a resposta significa é a
 * pessoa que conduz a entrevista.
 */

import { execute, queryAll, queryOne, transaction } from './query'
import {
  ID_PROTOCOLO_GERAL,
  PROTOCOLOS_FIXTURE,
  type Protocolo,
} from '../../shared/protocolos'

type LinhaProtocolo = {
  id: string
  nome: string
  regime: string
  blocos: string[] | null
  procedimentos: string[] | null
  versao: number
  origem: 'FIXTURE' | 'OPERADOR'
  arquivado_em: string | null
}

function daLinha(linha: LinhaProtocolo): Protocolo {
  return {
    id: linha.id,
    nome: linha.nome,
    regime: linha.regime,
    blocos: linha.blocos ?? [],
    procedimentos: linha.procedimentos ?? [],
    versao: linha.versao,
    origem: linha.origem,
    arquivadoEm: linha.arquivado_em,
  }
}

/** `TEXT[]` a partir de JSON — evita depender da serialização de array do driver. */
const COMO_TEXTO_ARRAY = (posicao: number) =>
  `ARRAY(SELECT jsonb_array_elements_text($${posicao}::jsonb))`

/** Grava a fixture uma única vez. Edição do operador jamais é sobrescrita. */
export async function seedProtocolos(): Promise<void> {
  const novos: string[] = []
  await transaction(async () => {
    for (const p of PROTOCOLOS_FIXTURE) {
      const { changes } = await execute(
        `INSERT INTO protocolos_anamnese
           (id, nome, regime, blocos, procedimentos, versao, origem)
         VALUES ($1, $2, $3, ${COMO_TEXTO_ARRAY(4)}, ${COMO_TEXTO_ARRAY(5)}, $6, 'FIXTURE')
         ON CONFLICT (id) DO NOTHING`,
        p.id,
        p.nome,
        p.regime,
        JSON.stringify(p.blocos),
        JSON.stringify(p.procedimentos),
        p.versao,
      )
      if (changes > 0) novos.push(p.id)
    }
  })
  if (novos.length > 0) {
    console.log(`[seed] Protocolos de coleta gravados no primeiro boot: ${novos.length}.`)
  }
}

export async function listarProtocolos(
  opcoes: { incluirArquivados?: boolean } = {},
): Promise<Protocolo[]> {
  const linhas = await queryAll<LinhaProtocolo>(
    `SELECT id, nome, regime, blocos, procedimentos, versao, origem, arquivado_em
       FROM protocolos_anamnese
      ${opcoes.incluirArquivados ? '' : 'WHERE arquivado_em IS NULL'}
      ORDER BY (id = '${ID_PROTOCOLO_GERAL}'), nome`,
  )
  return linhas.map(daLinha)
}

async function obter(id: string): Promise<Protocolo | undefined> {
  const linha = await queryOne<LinhaProtocolo>(
    `SELECT id, nome, regime, blocos, procedimentos, versao, origem, arquivado_em
       FROM protocolos_anamnese WHERE id = $1`,
    id,
  )
  return linha ? daLinha(linha) : undefined
}

/**
 * Um procedimento pertence a um protocolo só — senão a pergunta "qual entrevista
 * esta cirurgia abre?" teria duas respostas. Recusar é melhor que roubar em
 * silêncio: a tela mostra quem já usa antes de a pessoa escolher.
 */
async function recusarProcedimentoJaUsado(id: string, procedimentos: string[]): Promise<void> {
  if (procedimentos.length === 0) return
  const conflito = await queryOne<{ nome: string; procedimento: string }>(
    `SELECT p.nome, x.procedimento
       FROM protocolos_anamnese p,
            LATERAL unnest(p.procedimentos) AS x(procedimento)
      WHERE p.id <> $1
        AND p.arquivado_em IS NULL
        AND lower(btrim(x.procedimento)) = ANY (
              SELECT lower(btrim(v)) FROM jsonb_array_elements_text($2::jsonb) AS t(v)
            )
      LIMIT 1`,
    id,
    JSON.stringify(procedimentos),
  )
  if (conflito) {
    throw new Error(
      `"${conflito.procedimento}" já é atendido pelo protocolo "${conflito.nome}". ` +
        'Remova de lá antes de usar aqui.',
    )
  }
}

export type EntradaProtocolo = {
  id?: string
  nome: string
  regime: string
  blocos: string[]
  procedimentos: string[]
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

async function idLivre(base: string): Promise<string> {
  let candidato = base
  let n = 1
  while (await obter(candidato)) candidato = `${base}_${++n}`
  return candidato
}

/**
 * Cria ou atualiza. A versão sobe quando a **composição** muda, não quando o
 * nome muda: é a lista de perguntas que precisa ser rastreável, porque casos
 * antigos foram coletados sob a lista antiga.
 */
export async function salvarProtocolo(entrada: EntradaProtocolo): Promise<Protocolo> {
  const nome = entrada.nome.trim()
  if (!nome) throw new Error('O protocolo precisa de um nome.')

  const blocos = [...new Set(entrada.blocos)]
  const procedimentos = [...new Set(entrada.procedimentos.map((p) => p.trim()).filter(Boolean))]

  const existente = entrada.id ? await obter(entrada.id) : undefined
  if (entrada.id && !existente) throw new Error(`Protocolo "${entrada.id}" não existe mais.`)

  const id = existente?.id ?? (await idLivre(idDoNome(nome)))
  await recusarProcedimentoJaUsado(id, procedimentos)

  const composicaoMudou =
    !existente || existente.blocos.join('|') !== blocos.join('|')
  const versao = existente ? existente.versao + (composicaoMudou ? 1 : 0) : 1

  await execute(
    `INSERT INTO protocolos_anamnese
       (id, nome, regime, blocos, procedimentos, versao, origem)
     VALUES ($1, $2, $3, ${COMO_TEXTO_ARRAY(4)}, ${COMO_TEXTO_ARRAY(5)}, $6, 'OPERADOR')
     ON CONFLICT (id) DO UPDATE SET
       nome = EXCLUDED.nome,
       regime = EXCLUDED.regime,
       blocos = EXCLUDED.blocos,
       procedimentos = EXCLUDED.procedimentos,
       versao = EXCLUDED.versao,
       -- Linha de fábrica que alguém editou deixa de ser de fábrica: é o sinal
       -- de que restaurar o padrão vai desfazer trabalho humano.
       origem = 'OPERADOR',
       arquivado_em = NULL,
       atualizado_em = now()`,
    id,
    nome,
    entrada.regime.trim(),
    JSON.stringify(blocos),
    JSON.stringify(procedimentos),
    versao,
  )

  const salvo = await obter(id)
  if (!salvo) throw new Error('O protocolo não foi gravado.')
  return salvo
}

/** Cópia sem procedimentos: quem duplica ainda vai decidir onde ela se aplica. */
export async function duplicarProtocolo(id: string): Promise<Protocolo> {
  const origem = await obter(id)
  if (!origem) throw new Error(`Protocolo "${id}" não existe.`)
  return salvarProtocolo({
    nome: `${origem.nome} (cópia)`,
    regime: origem.regime,
    blocos: origem.blocos,
    procedimentos: [],
  })
}

/**
 * Arquivar em vez de apagar: um protocolo que já abriu entrevistas continua
 * sendo a explicação de por que aqueles casos coletaram o que coletaram.
 */
export async function arquivarProtocolo(id: string): Promise<{ ok: true }> {
  if (id === ID_PROTOCOLO_GERAL) {
    throw new Error('O protocolo geral é o fallback do sistema e não pode ser arquivado.')
  }
  const { changes } = await execute(
    `UPDATE protocolos_anamnese
        SET arquivado_em = now(), atualizado_em = now()
      WHERE id = $1 AND arquivado_em IS NULL`,
    id,
  )
  if (changes === 0) throw new Error(`Protocolo "${id}" não está ativo.`)
  return { ok: true }
}

export async function restaurarProtocolo(id: string): Promise<Protocolo> {
  await execute(
    `UPDATE protocolos_anamnese
        SET arquivado_em = NULL, atualizado_em = now()
      WHERE id = $1`,
    id,
  )
  const restaurado = await obter(id)
  if (!restaurado) throw new Error(`Protocolo "${id}" não existe.`)
  return restaurado
}

/**
 * Devolve tudo ao estado de nascimento. Existe para a demonstração poder ser
 * bagunçada sem medo — e apaga o que o operador criou, por isso a tela pede
 * confirmação explícita.
 */
export async function restaurarFixture(): Promise<Protocolo[]> {
  await transaction(async () => {
    await execute('DELETE FROM protocolos_anamnese')
  })
  await seedProtocolos()
  return listarProtocolos()
}
