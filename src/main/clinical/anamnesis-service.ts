import { randomUUID } from 'node:crypto'
import { execute, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento, obterCaso } from './case-service'
import { listarProtocolos } from '../db/protocolos'
import { materializarComposicao } from '../../shared/clinical/anamnese-inicial'
import { protocoloPara } from '../../shared/protocolos'
import {
  ErroDeCaso,
  type ActorSnapshot,
  type AnamnesisBlock,
  type AnamnesisDTO,
  type CaseStatus,
} from '../../shared/clinical/caso'

/**
 * Anamnese do caso.
 *
 * Uma por caso, criada sob demanda a partir do protocolo do procedimento. O
 * rascunho é salvo a cada mudança e sobrevive ao fechar o aplicativo — retomar
 * a entrevista é recuperar trabalho, não refazê-lo.
 *
 * Publicar congela uma revisão imutável. Depois disso o rascunho não volta a ser
 * editável: o que a enfermagem publicou é o que o requisito usou, e reescrever o
 * passado apagaria a explicação do presente.
 */

type LinhaAnamnese = {
  id: string
  case_id: string
  protocol_id: string
  protocol_version: number
  protocol_blocks: string[]
  status: 'DRAFT' | 'FINAL'
  blocks: AnamnesisBlock[]
  revision: number
  version: number
  updated_at: string
  finalized_at: string | null
  finalized_by: ActorSnapshot | null
}

function daLinha(l: LinhaAnamnese): AnamnesisDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    status: l.status,
    protocolId: l.protocol_id,
    protocolVersion: l.protocol_version,
    protocolBlocks: l.protocol_blocks ?? [],
    blocks: l.blocks ?? [],
    revision: l.revision,
    version: l.version,
    updatedAt: l.updated_at,
    finalizedAt: l.finalized_at,
    finalizedBy: l.finalized_by,
  }
}

const ESTADOS_QUE_ACEITAM_ENTREVISTA: CaseStatus[] = [
  'WAITING_NURSING',
  'NURSING_IN_PROGRESS',
  'TRIAGE_PENDING',
]

/**
 * Abre a entrevista do caso, criando-a na primeira vez.
 *
 * A composição vem do protocolo do procedimento no momento da abertura e fica
 * gravada na anamnese: se alguém editar o protocolo depois, o caso já aberto
 * continua explicado pela composição que de fato usou.
 */
export async function abrirAnamnese(caseId: string): Promise<AnamnesisDTO> {
  await garantirContaSintetica()

  const existente = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE case_id = $1`,
    caseId,
  )
  if (existente) return daLinha(existente)

  const caso = await obterCaso(caseId)
  if (!ESTADOS_QUE_ACEITAM_ENTREVISTA.includes(caso.status)) {
    throw new ErroDeCaso(
      'INVALID_TRANSITION',
      'A entrevista só abre em caso aguardando ou em atendimento da enfermagem.',
    )
  }

  const protocolos = await listarProtocolos()
  const protocolo = protocoloPara(caso.procedure.description, protocolos)
  const anamnesisId = randomUUID()
  const blocos = materializarComposicao(protocolo.blocos, () => randomUUID()).map((b) =>
    // O contexto do procedimento não é pergunta: é transcrição do que veio no
    // encaminhamento. Ele nasce preenchido pelos snapshots do caso, senão o
    // bloco pediria à enfermagem que redigitasse o papel que a recepção já leu.
    b.tipo === 'procedure_context'
      ? {
          ...b,
          dados: {
            indicacao: caso.procedure.description,
            lateralidade: caso.procedure.lateralityOrSite ?? undefined,
            observacaoEncaminhamento: caso.referral.freeTextReference || undefined,
          },
        }
      : b,
  )
  const atorEnfermagem = ator('ENFERMAGEM')

  await transaction(async () => {
    await execute(
      `INSERT INTO clinical_anamneses (
         id, case_id, protocol_id, protocol_version, protocol_blocks, status, blocks, provenance
       ) VALUES ($1,$2,$3,$4,$5::jsonb,'DRAFT',$6::jsonb,$7::jsonb)`,
      anamnesisId,
      caseId,
      protocolo.id,
      protocolo.versao,
      JSON.stringify(protocolo.blocos),
      JSON.stringify(blocos),
      JSON.stringify({ abertoPor: atorEnfermagem, abertoEm: new Date().toISOString() }),
    )

    await registrarEvento({
      caseId,
      eventType: 'ANAMNESIS_STARTED',
      fromStatus: caso.status,
      toStatus: caso.status,
      actor: atorEnfermagem,
      payload: {
        anamnesisId,
        protocolId: protocolo.id,
        protocolVersion: protocolo.versao,
        blocos: protocolo.blocos.length,
      },
      receiptDomain: 'ANAMNESIS',
      receiptId: anamnesisId,
      commandEventIndex: 1,
    })
  })

  const criada = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE id = $1`,
    anamnesisId,
  )
  return daLinha(criada!)
}

export async function obterAnamnese(caseId: string): Promise<AnamnesisDTO | null> {
  const linha = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE case_id = $1`,
    caseId,
  )
  return linha ? daLinha(linha) : null
}

/**
 * Salva o rascunho. É o autosave: chamado a cada mudança de bloco.
 *
 * Guarda blocos e ordem. Anamnese publicada recusa escrita — a recusa é o
 * contrato, não um detalhe de implementação.
 */
export async function salvarRascunho(entrada: {
  anamnesisId: string
  expectedVersion: number
  blocks: AnamnesisBlock[]
}): Promise<AnamnesisDTO> {
  const linha = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE id = $1`,
    entrada.anamnesisId,
  )
  if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Anamnese não encontrada.')
  if (linha.status === 'FINAL') {
    throw new ErroDeCaso('INVALID_TRANSITION', 'A entrevista já foi finalizada e não aceita edição.')
  }
  if (linha.version !== entrada.expectedVersion) {
    throw new ErroDeCaso('VERSION_CONFLICT', 'A entrevista mudou em outra janela.')
  }

  await execute(
    `UPDATE clinical_anamneses
        SET blocks = $2::jsonb, version = version + 1, updated_at = NOW()
      WHERE id = $1`,
    entrada.anamnesisId,
    JSON.stringify(entrada.blocks),
  )

  const atualizada = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE id = $1`,
    entrada.anamnesisId,
  )
  return daLinha(atualizada!)
}

/**
 * Finaliza a entrevista: congela a revisão e marca o caso como triado.
 *
 * Recusa publicar com a composição incompleta. É a regra do protocolo aplicada
 * onde importa: incluído é obrigatório.
 */
export async function finalizarAnamnese(entrada: {
  anamnesisId: string
  expectedVersion: number
}): Promise<{ anamnesis: AnamnesisDTO; pendentes: string[] }> {
  await garantirContaSintetica()
  const { calcularRequisito } = await import('../../shared/clinical/carga')

  const linha = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE id = $1`,
    entrada.anamnesisId,
  )
  if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Anamnese não encontrada.')
  if (linha.status === 'FINAL') return { anamnesis: daLinha(linha), pendentes: [] }
  if (linha.version !== entrada.expectedVersion) {
    throw new ErroDeCaso('VERSION_CONFLICT', 'A entrevista mudou em outra janela.')
  }

  const prévia = calcularRequisito(linha.blocks ?? [], linha.protocol_blocks ?? [])
  if (prévia.pendentes.length > 0) {
    throw new ErroDeCaso(
      'VALIDATION_ERROR',
      `A composição ainda tem ${prévia.pendentes.length} bloco(s) sem resposta: ${prévia.pendentes.join(', ')}.`,
    )
  }

  const atorEnfermagem = ator('ENFERMAGEM')
  const revisao = linha.revision + 1
  const quando = new Date().toISOString()

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      linha.case_id,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    await execute(
      `UPDATE clinical_anamneses
          SET status = 'FINAL', revision = $2, finalized_at = $3, finalized_by = $4::jsonb,
              version = version + 1, updated_at = $3
        WHERE id = $1`,
      entrada.anamnesisId,
      revisao,
      quando,
      JSON.stringify(atorEnfermagem),
    )

    await execute(
      `INSERT INTO clinical_anamnesis_revisions (
         anamnesis_id, case_id, revision, blocks, protocol_blocks, provenance, finalized_by, finalized_at
       ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      entrada.anamnesisId,
      linha.case_id,
      revisao,
      JSON.stringify(linha.blocks ?? []),
      JSON.stringify(linha.protocol_blocks ?? []),
      JSON.stringify({ finalizadoEm: quando }),
      JSON.stringify(atorEnfermagem),
      quando,
    )

    // A entrevista termina com o caso em atendimento da enfermagem, pronto para
    // o requisito ser calculado e confirmado por gente.
    await execute(
      `UPDATE preop_cases SET status = 'NURSING_IN_PROGRESS', version = version + 1, updated_at = $2
        WHERE id = $1`,
      linha.case_id,
      quando,
    )

    await registrarEvento({
      caseId: linha.case_id,
      eventType: 'ANAMNESIS_FINALIZED',
      fromStatus: caso.status,
      toStatus: 'NURSING_IN_PROGRESS',
      actor: atorEnfermagem,
      payload: { anamnesisId: entrada.anamnesisId, revision: revisao },
      receiptDomain: 'ANAMNESIS',
      receiptId: `${entrada.anamnesisId}:${revisao}`,
      commandEventIndex: 1,
    })
  })

  const atualizada = await queryOne<LinhaAnamnese>(
    `SELECT * FROM clinical_anamneses WHERE id = $1`,
    entrada.anamnesisId,
  )
  return { anamnesis: daLinha(atualizada!), pendentes: [] }
}
