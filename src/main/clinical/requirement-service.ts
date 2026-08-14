import { randomUUID, createHash } from 'node:crypto'
import { execute, queryOne, transaction } from '../db/query'
import { ator, garantirContaSintetica } from '../auth/session'
import { registrarEvento } from './case-service'
import {
  calcularRequisito,
  BUFFER_POR_CLASSE,
  CLASSE_CANONICA,
  DURACAO_POR_CLASSE,
  type ClasseVaga,
} from '../../shared/clinical/carga'
import {
  ErroDeCaso,
  type ActorSnapshot,
  type AnamnesisBlock,
  type CaseStatus,
  type RequirementDTO,
  type SlotClass,
} from '../../shared/clinical/caso'

/**
 * Requisito operacional da consulta.
 *
 * Traduz a entrevista publicada em necessidade de agenda: quanto tempo, que
 * classe de vaga, que recursos. **Não** produz risco, ASA, gravidade nem
 * aptidão — a pergunta é "quanto dura esta conversa", e a resposta é auditável
 * parcela por parcela.
 *
 * O cálculo é sugestão. Ele só vira compromisso quando uma pessoa confirma, e a
 * confirmação é o que publica o caso para a fila de agendamento. IA e regra
 * sugerem; humano decide.
 */

type LinhaRequisito = {
  id: string
  case_id: string
  anamnesis_id: string
  anamnesis_revision: number
  status: 'CALCULATED' | 'CONFIRMED' | 'OVERRIDDEN'
  slot_class: SlotClass
  duration_minutes: number
  buffer_minutes: number
  calculated_minutes: number
  required_capabilities: string[]
  operational_explanation: string[]
  pending_field_paths: string[]
  version: number
  created_at: string
  confirmed_at: string | null
  confirmed_by: ActorSnapshot | null
}

function daLinha(l: LinhaRequisito): RequirementDTO {
  return {
    id: l.id,
    caseId: l.case_id,
    anamnesisId: l.anamnesis_id,
    anamnesisRevision: l.anamnesis_revision,
    status: l.status,
    slotClass: l.slot_class,
    durationMinutes: l.duration_minutes,
    bufferMinutes: l.buffer_minutes,
    calculatedMinutes: l.calculated_minutes,
    requiredCapabilities: l.required_capabilities ?? [],
    operationalExplanation: l.operational_explanation ?? [],
    pendingFieldPaths: l.pending_field_paths ?? [],
    version: l.version,
    createdAt: l.created_at,
    confirmedAt: l.confirmed_at,
    confirmedBy: l.confirmed_by,
  }
}

/**
 * Frases que a recepção pode ler.
 *
 * A explicação operacional nunca cita achado clínico. "Revisão ampliada" é o que
 * a recepção precisa para entender o tamanho da vaga; o que foi encontrado na
 * entrevista é assunto da enfermagem e do anestesista.
 */
function explicacaoOperacional(sinais: { rotulo: string; minutos: number }[]): string[] {
  const frases: string[] = []
  const pagos = sinais.filter((s) => s.minutos > 0)
  const dominios = pagos.filter((s) => s.minutos === 5 && s.rotulo !== 'Acomodação necessária')
  if (dominios.length > 0) frases.push('Revisão ampliada por achados na entrevista')
  if (pagos.some((s) => s.rotulo === 'Medicações em uso')) {
    frases.push('Múltiplos itens para conciliação')
  }
  if (pagos.some((s) => s.rotulo === 'Diagnósticos')) {
    frases.push('Múltiplas condições relatadas')
  }
  if (pagos.some((s) => s.rotulo === 'Acomodação necessária')) {
    frases.push('Acomodação necessária na sala')
  }
  if (frases.length === 0) frases.push('Entrevista sem fatores que aumentem a duração')
  return frases
}

/** Capacidades que a vaga precisa ter. Operacional, nunca motivo clínico. */
function capacidadesNecessarias(blocos: AnamnesisBlock[]): string[] {
  const capacidades = new Set<string>()
  for (const b of blocos) {
    if (b.tipo !== 'accommodations') continue
    const d = b.dados as {
      mobilidade?: { estado: string; valor?: boolean }
      comunicacao?: { estado: string; valor?: boolean }
      representanteLegal?: { estado: string; valor?: boolean }
    }
    if (d.mobilidade?.estado === 'RESPONDIDO' && d.mobilidade.valor) capacidades.add('SALA_ACESSIVEL')
    if (d.comunicacao?.estado === 'RESPONDIDO' && d.comunicacao.valor) capacidades.add('APOIO_COMUNICACAO')
    if (d.representanteLegal?.estado === 'RESPONDIDO' && d.representanteLegal.valor) {
      capacidades.add('ESPACO_ACOMPANHANTE')
    }
  }
  for (const b of blocos) {
    if (b.tipo !== 'escort_and_transport') continue
    const d = b.dados as { temAcompanhante?: { estado: string; valor?: boolean } }
    if (d.temAcompanhante?.estado === 'RESPONDIDO' && d.temAcompanhante.valor) {
      capacidades.add('ESPACO_ACOMPANHANTE')
    }
  }
  return [...capacidades].sort()
}

/**
 * Calcula a partir da revisão publicada.
 *
 * `FORA_DA_FAIXA` não vira vaga silenciosamente: a demonstração declara que o
 * caso passou do que ela sabe dimensionar e a classe cai em `EXTENDED` com o
 * cálculo original preservado para a pessoa decidir.
 */
export async function calcularParaCaso(caseId: string): Promise<RequirementDTO> {
  await garantirContaSintetica()

  const anamnese = await queryOne<{
    id: string
    revision: number
    status: string
    blocks: AnamnesisBlock[]
    protocol_blocks: string[]
  }>(
    `SELECT id, revision, status, blocks, protocol_blocks FROM clinical_anamneses WHERE case_id = $1`,
    caseId,
  )
  if (!anamnese) throw new ErroDeCaso('NOT_FOUND', 'Este caso ainda não tem entrevista.')
  if (anamnese.status !== 'FINAL') {
    throw new ErroDeCaso('INVALID_TRANSITION', 'O requisito só é calculado depois de finalizar a entrevista.')
  }

  const existente = await queryOne<LinhaRequisito>(
    `SELECT * FROM scheduling_requirements
      WHERE case_id = $1 AND anamnesis_revision = $2
      ORDER BY created_at DESC LIMIT 1`,
    caseId,
    anamnese.revision,
  )
  if (existente) return daLinha(existente)

  const calculo = calcularRequisito(anamnese.blocks ?? [], anamnese.protocol_blocks ?? [])
  const classe: ClasseVaga = calculo.classe
  const canonica: SlotClass = CLASSE_CANONICA[classe] ?? 'EXTENDED'
  const requirementId = randomUUID()
  const atorEnfermagem = ator('ENFERMAGEM')

  const explicacao = explicacaoOperacional(calculo.sinais)
  if (classe === 'FORA_DA_FAIXA') {
    explicacao.unshift(
      `Cálculo de ${calculo.minutos} min passou do que a demonstração dimensiona; oferecida a maior vaga`,
    )
  }

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      caseId,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    await execute(
      `INSERT INTO scheduling_requirements (
         id, case_id, anamnesis_id, anamnesis_revision, status, slot_class,
         duration_minutes, buffer_minutes, calculated_minutes, required_capabilities,
         operational_explanation, pending_field_paths, input_fingerprint
       ) VALUES ($1,$2,$3,$4,'CALCULATED',$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12)`,
      requirementId,
      caseId,
      anamnese.id,
      anamnese.revision,
      canonica,
      DURACAO_POR_CLASSE[canonica],
      BUFFER_POR_CLASSE[classe],
      calculo.minutos,
      JSON.stringify(capacidadesNecessarias(anamnese.blocks ?? [])),
      JSON.stringify(explicacao),
      JSON.stringify(calculo.pendentes),
      createHash('sha256').update(JSON.stringify(anamnese.blocks ?? [])).digest('hex'),
    )

    await registrarEvento({
      caseId,
      eventType: 'REQUIREMENT_CALCULATED',
      fromStatus: caso.status,
      toStatus: caso.status,
      actor: atorEnfermagem,
      payload: {
        requirementId,
        slotClass: canonica,
        calculatedMinutes: calculo.minutos,
      },
      receiptDomain: 'SCHEDULING',
      receiptId: requirementId,
      commandEventIndex: 1,
    })
  })

  const criado = await queryOne<LinhaRequisito>(
    `SELECT * FROM scheduling_requirements WHERE id = $1`,
    requirementId,
  )
  return daLinha(criado!)
}

/**
 * Confirma — ou ajusta — e publica para a fila de agendamento.
 *
 * `slotClassEscolhida` diferente do calculado exige motivo e grava override: a
 * decisão humana é bem-vinda, o silêncio sobre ela não. Só depois disso o caso
 * fica `READY_FOR_SCHEDULING`.
 */
export async function confirmarRequisito(entrada: {
  requirementId: string
  expectedVersion: number
  slotClassEscolhida?: SlotClass
  motivo?: string
}): Promise<RequirementDTO> {
  await garantirContaSintetica()
  const atorEnfermagem = ator('ENFERMAGEM')

  const linha = await queryOne<LinhaRequisito>(
    `SELECT * FROM scheduling_requirements WHERE id = $1`,
    entrada.requirementId,
  )
  if (!linha) throw new ErroDeCaso('NOT_FOUND', 'Requisito não encontrado.')
  if (linha.status !== 'CALCULATED') {
    throw new ErroDeCaso('INVALID_TRANSITION', 'Este requisito já foi publicado.')
  }
  if (linha.version !== entrada.expectedVersion) {
    throw new ErroDeCaso('VERSION_CONFLICT', 'O requisito mudou em outra janela.')
  }

  const escolhida = entrada.slotClassEscolhida ?? linha.slot_class
  const houveAjuste = escolhida !== linha.slot_class
  if (houveAjuste) {
    const motivo = entrada.motivo?.trim() ?? ''
    if (motivo.length < 10 || motivo.length > 1000) {
      throw new ErroDeCaso(
        'VALIDATION_ERROR',
        'Trocar a classe da vaga exige um motivo de 10 a 1000 caracteres.',
      )
    }
  }

  const quando = new Date().toISOString()
  const novoStatus = houveAjuste ? 'OVERRIDDEN' : 'CONFIRMED'
  const buffer = escolhida === 'EXTENDED' ? 10 : 5

  await transaction(async () => {
    const caso = await queryOne<{ status: CaseStatus }>(
      `SELECT status FROM preop_cases WHERE id = $1 FOR UPDATE`,
      linha.case_id,
    )
    if (!caso) throw new ErroDeCaso('NOT_FOUND', 'Caso não encontrado.')

    await execute(
      `UPDATE scheduling_requirements
          SET status = $2, slot_class = $3, duration_minutes = $4, buffer_minutes = $5,
              confirmed_at = $6, confirmed_by = $7::jsonb, published_at = $6,
              version = version + 1
        WHERE id = $1`,
      entrada.requirementId,
      novoStatus,
      escolhida,
      DURACAO_POR_CLASSE[escolhida],
      buffer,
      quando,
      JSON.stringify(atorEnfermagem),
    )

    if (houveAjuste) {
      await execute(
        `INSERT INTO scheduling_overrides (
           requirement_id, from_class, to_class, to_duration_minutes, reason, actor_snapshot
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        entrada.requirementId,
        linha.slot_class,
        escolhida,
        DURACAO_POR_CLASSE[escolhida],
        entrada.motivo!.trim(),
        JSON.stringify(atorEnfermagem),
      )
    }

    await execute(
      `UPDATE preop_cases SET status = 'READY_FOR_SCHEDULING', version = version + 1, updated_at = $2
        WHERE id = $1`,
      linha.case_id,
      quando,
    )

    await registrarEvento({
      caseId: linha.case_id,
      eventType: houveAjuste ? 'REQUIREMENT_OVERRIDDEN' : 'REQUIREMENT_CONFIRMED',
      fromStatus: caso.status,
      toStatus: 'READY_FOR_SCHEDULING',
      actor: atorEnfermagem,
      reason: houveAjuste ? entrada.motivo!.trim() : null,
      payload: { requirementId: entrada.requirementId, slotClass: escolhida },
      receiptDomain: 'SCHEDULING',
      receiptId: `${entrada.requirementId}:publish`,
      commandEventIndex: 1,
    })
  })

  const atualizado = await queryOne<LinhaRequisito>(
    `SELECT * FROM scheduling_requirements WHERE id = $1`,
    entrada.requirementId,
  )
  return daLinha(atualizado!)
}

export async function obterRequisitoDoCaso(caseId: string): Promise<RequirementDTO | null> {
  const linha = await queryOne<LinhaRequisito>(
    `SELECT * FROM scheduling_requirements WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
    caseId,
  )
  return linha ? daLinha(linha) : null
}
