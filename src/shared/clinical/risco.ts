/**
 * Classificação de risco pré-anestésico.
 *
 * Porte TypeScript fiel do protótipo validado em
 * /Volumes/Vader/Marco/antessala/src/lib/risco.js. Esta função é pura: não
 * conhece React, banco, rede, cadastro de paciente ou motor de fila.
 *
 * LEI: dado ausente vira pendência; nunca vira valor presumido.
 */

export type SexoRisco = string | null
export type PorteProcedimento = 'baixo' | 'intermediario' | 'alto'
export type PesoRisco = 'alto' | 'medio' | 'baixo'
export type FaixaLee = 'alto' | 'intermediario' | 'baixo'
export type ClasseAsa = 'I' | 'II' | 'III'
export type RotaRiscoId = 'sucinta' | 'plena' | 'encaminhar'

export interface RegraRisco {
  readonly id: string
  readonly nome: string
  readonly resumo: string
  readonly conferir: true
}

export interface PessoaRisco {
  /** Valor embutido no registro; nunca é chave para uma tabela de pacientes. */
  idade?: number | null
  sexo?: SexoRisco
}

export interface ComorbidadeRisco {
  id: string
  controlado?: boolean | null
}

export interface MedicamentoRisco {
  id: string
  nome: string
  principio?: string
  grupo?: string
}

export interface EntradaRisco {
  paciente?: PessoaRisco
  procedimento?: { porte?: PorteProcedimento | null }
  comorbidades?: ComorbidadeRisco[]
  medicamentos?: MedicamentoRisco[]
  capacidade?: { met?: number | null; atividade?: string | null }
}

export interface GrupoRisco {
  id: string
  rotulo: string
  conduta: string
  peso: PesoRisco
}

export interface RotaRisco {
  readonly id: RotaRiscoId
  readonly rotulo: string
  readonly detalhe: string
  readonly tom: 'ok' | 'atencao' | 'alerta'
}

export const REGRAS = {
  asa: {
    id: 'asa',
    nome: 'Estado físico (ASA-PS)',
    resumo: 'Classifica o paciente pela presença e gravidade de doença sistêmica.',
    conferir: true,
  },
  lee: {
    id: 'lee',
    nome: 'Índice de risco cardíaco revisado (Lee/RCRI)',
    resumo: 'Seis preditores clínicos; o total posiciona o risco cardíaco perioperatório.',
    conferir: true,
  },
  mets: {
    id: 'mets',
    nome: 'Capacidade funcional em METs',
    resumo: 'Capacidade abaixo do corte indica investigação adicional.',
    conferir: true,
  },
} as const satisfies Record<string, RegraRisco>

export const CORTES = {
  metsAdequado: 4,
  leeIntermediario: 1,
  leeAlto: 3,
  /** Mantido por paridade com o protótipo; ainda não participa do cálculo. */
  idadeAtencao: 65,
} as const

export const PORTES = [
  { id: 'baixo', rotulo: 'Baixo', exemplo: 'procedimento superficial, ambulatorial' },
  { id: 'intermediario', rotulo: 'Intermediário', exemplo: 'intracavitário eletivo' },
  { id: 'alto', rotulo: 'Alto', exemplo: 'vascular maior, grande porte' },
] as const

export const ROTAS = {
  sucinta: {
    id: 'sucinta',
    rotulo: 'Avaliação sucinta',
    detalhe: 'Segue sem consulta presencial com o anestesista.',
    tom: 'ok',
  },
  plena: {
    id: 'plena',
    rotulo: 'Avaliação plena com anestesista',
    detalhe: 'Consulta presencial antes do procedimento.',
    tom: 'atencao',
  },
  encaminhar: {
    id: 'encaminhar',
    rotulo: 'Avaliação plena + encaminhamento',
    detalhe: 'Precisa de parecer de outra especialidade antes de liberar.',
    tom: 'alerta',
  },
} as const satisfies Record<RotaRiscoId, RotaRisco>

const LEE = {
  coronariopatia: 'Doença arterial coronariana',
  'insuficiencia-cardiaca': 'Insuficiência cardíaca',
  'avc-previo': 'Doença cerebrovascular',
  'doenca-renal-cronica': 'Doença renal crônica',
} as const

const ENCAMINHA = {
  dpoc: 'pneumologia',
  asma: 'pneumologia',
  'apneia-do-sono': 'pneumologia',
  'doenca-renal-cronica': 'nefrologia',
  hepatopatia: 'hepatologia',
} as const

const ORDEM_PESO: Record<PesoRisco, number> = { alto: 0, medio: 1, baixo: 2 }

function numeroFinito(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

export function classificarRisco(
  entrada: EntradaRisco,
  gruposRisco: readonly GrupoRisco[] = [],
) {
  const paciente = entrada.paciente ?? {}
  const procedimento = entrada.procedimento ?? {}
  const comorbidades = entrada.comorbidades ?? []
  const medicamentos = entrada.medicamentos ?? []
  const capacidade = entrada.capacidade ?? {}

  const pendencias: Array<{ campo: string; porque: string }> = []
  const temComorbidade = (id: string) => comorbidades.some((item) => item.id === id)
  const descompensadas = comorbidades.filter((item) => item.controlado === false)

  const idade = numeroFinito(paciente.idade)
  if (idade === null) {
    pendencias.push({ campo: 'idade', porque: 'entra na leitura do estado físico' })
  }
  if (!paciente.sexo) {
    pendencias.push({ campo: 'sexo', porque: 'referências clínicas variam por sexo' })
  }
  if (!procedimento.porte) {
    pendencias.push({
      campo: 'porte do procedimento',
      porque: 'é preditor do índice de Lee e define a rota',
    })
  }
  const met = numeroFinito(capacidade.met)
  if (met === null) {
    pendencias.push({
      campo: 'capacidade funcional',
      porque: 'sem ela, a rota não pode ser reduzida',
    })
  }

  let classeAsa: ClasseAsa = 'I'
  let motivoAsa = 'Sem doença sistêmica registrada.'
  if (descompensadas.length > 0) {
    classeAsa = 'III'
    motivoAsa = `Doença sistêmica registrada como não controlada (${descompensadas.length}).`
  } else if (comorbidades.length > 0) {
    classeAsa = 'II'
    motivoAsa = `Doença sistêmica controlada (${comorbidades.length}).`
  }

  const criteriosLee: Array<{ id: string; rotulo: string }> = []
  for (const [id, rotulo] of Object.entries(LEE)) {
    if (temComorbidade(id)) criteriosLee.push({ id, rotulo })
  }
  if (procedimento.porte === 'alto') {
    criteriosLee.push({ id: 'porte-alto', rotulo: 'Procedimento de alto risco' })
  }
  const usaInsulina = medicamentos.some(
    (medicamento) =>
      medicamento.grupo === 'antidiabetico' &&
      /insulina/i.test(`${medicamento.nome} ${medicamento.principio ?? ''}`),
  )
  if (usaInsulina) {
    criteriosLee.push({ id: 'insulina', rotulo: 'Diabetes em uso de insulina' })
  }

  const totalLee = criteriosLee.length
  const faixaLee: FaixaLee =
    totalLee >= CORTES.leeAlto
      ? 'alto'
      : totalLee >= CORTES.leeIntermediario
        ? 'intermediario'
        : 'baixo'

  const porGrupo = new Map<string, string[]>()
  for (const medicamento of medicamentos) {
    if (!medicamento.grupo) continue
    const nomes = porGrupo.get(medicamento.grupo) ?? []
    nomes.push(medicamento.nome)
    porGrupo.set(medicamento.grupo, nomes)
  }
  const alertas = [...porGrupo.entries()]
    .map(([grupoId, nomes]) => {
      const grupo = gruposRisco.find((item) => item.id === grupoId)
      return {
        grupo: grupoId,
        rotulo: grupo?.rotulo ?? grupoId,
        conduta: grupo?.conduta ?? '',
        peso: grupo?.peso ?? ('baixo' as const),
        medicamentos: nomes,
      }
    })
    .sort((a, b) => ORDEM_PESO[a.peso] - ORDEM_PESO[b.peso])

  const encaminhamentos: Array<{ comorbidade: string; especialidade: string }> = []
  for (const [id, especialidade] of Object.entries(ENCAMINHA)) {
    const comorbidade = comorbidades.find((item) => item.id === id)
    if (comorbidade?.controlado === false) {
      encaminhamentos.push({ comorbidade: id, especialidade })
    }
  }

  const capacidadeAdequada = met === null ? null : met >= CORTES.metsAdequado
  let rota: RotaRisco = ROTAS.sucinta
  const motivos: string[] = []

  if (encaminhamentos.length > 0) {
    rota = ROTAS.encaminhar
    motivos.push(
      `Condição não controlada fora do eixo cardíaco: ${encaminhamentos
        .map((item) => item.especialidade)
        .join(', ')}.`,
    )
  } else if (faixaLee !== 'baixo' || classeAsa === 'III' || capacidadeAdequada !== true) {
    rota = ROTAS.plena
    if (faixaLee !== 'baixo') motivos.push(`Índice de Lee: ${totalLee} critério(s).`)
    if (classeAsa === 'III') motivos.push('Doença sistêmica não controlada.')
    if (capacidadeAdequada === false) {
      motivos.push(`Capacidade funcional abaixo de ${CORTES.metsAdequado} METs.`)
    }
    if (capacidadeAdequada === null) motivos.push('Capacidade funcional não informada.')
  } else {
    motivos.push(
      `Sem critério de Lee, doença sistêmica controlada e capacidade de ${met} METs.`,
    )
  }

  const alertasAltos = alertas.filter((alerta) => alerta.peso === 'alto')
  if (rota.id === 'sucinta' && alertasAltos.length > 0) {
    rota = ROTAS.plena
    motivos.push(
      `Medicação que exige manejo perioperatório: ${alertasAltos
        .map((alerta) => alerta.rotulo)
        .join(', ')}.`,
    )
  }

  return {
    estadoFisico: { classe: classeAsa, motivo: motivoAsa, regra: REGRAS.asa },
    riscoCardiaco: {
      criterios: criteriosLee,
      total: totalLee,
      faixa: faixaLee,
      regra: REGRAS.lee,
    },
    capacidade: {
      met,
      atividade: capacidade.atividade ?? null,
      adequada: capacidadeAdequada,
      corte: CORTES.metsAdequado,
      regra: REGRAS.mets,
    },
    rota: { ...rota, motivos },
    alertas,
    encaminhamentos,
    pendencias,
    completo: pendencias.length === 0,
  }
}

export type ResultadoRisco = ReturnType<typeof classificarRisco>
