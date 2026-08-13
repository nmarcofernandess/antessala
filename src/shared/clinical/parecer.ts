import type { EntradaRisco, ResultadoRisco } from './risco'

const PORTE_ROTULO = {
  baixo: 'baixo',
  intermediario: 'intermediário',
  alto: 'alto',
} as const

export interface ComorbidadeCatalogoParecer {
  id: string
  rotulo: string
  cid?: Array<{ codigo: string; descricao?: string }>
}

export interface MetaParecer {
  emitidoEm?: string
  sobreposicao?: string | null
  comorbidades?: readonly ComorbidadeCatalogoParecer[]
}

/** Parecer determinístico em texto puro; sem DOM, rede ou banco. */
export function resumoPaciente(ficha: EntradaRisco): string {
  const paciente = ficha.paciente ?? {}
  const partes: string[] = []
  if (paciente.idade != null) partes.push(`${paciente.idade} anos`)
  if (paciente.sexo) partes.push(paciente.sexo === 'F' ? 'feminino' : 'masculino')
  const porte = ficha.procedimento?.porte
  if (porte) partes.push(`procedimento de porte ${PORTE_ROTULO[porte] ?? porte}`)
  return partes.join(' · ') || 'sem identificação registrada'
}

export function gerarTextoParecer(
  ficha: EntradaRisco,
  resultado: ResultadoRisco,
  meta: MetaParecer = {},
): string {
  const linhas: string[] = []
  const linha = (conteudo = '') => linhas.push(conteudo)

  linha('PARECER DE TRIAGEM PRÉ-ANESTÉSICA')
  linha('='.repeat(46))
  linha(resumoPaciente(ficha))
  if (meta.emitidoEm) linha(`emitido em ${meta.emitidoEm}`)
  linha()

  linha('ROTA DE AVALIAÇÃO')
  if (meta.sobreposicao) {
    linha('  Decisão do profissional: outra rota que não a sugerida.')
    linha(`  Justificativa: ${meta.sobreposicao}`)
    linha(`  (sugestão do sistema era: ${resultado.rota.rotulo})`)
  } else {
    linha(`  ${resultado.rota.rotulo} — ${resultado.rota.detalhe}`)
  }
  for (const motivo of resultado.rota.motivos) linha(`  · ${motivo}`)
  linha()

  linha('BASE DA DECISÃO')
  linha(`  Estado físico: classe ${resultado.estadoFisico.classe}`)
  linha(`    regra: ${resultado.estadoFisico.regra.nome}`)
  linha(`    ${resultado.estadoFisico.motivo}`)
  linha(
    `  Risco cardíaco: ${resultado.riscoCardiaco.total} de 6 critérios ` +
      `(${resultado.riscoCardiaco.faixa})`,
  )
  linha(`    regra: ${resultado.riscoCardiaco.regra.nome}`)
  if (resultado.riscoCardiaco.criterios.length > 0) {
    for (const criterio of resultado.riscoCardiaco.criterios) linha(`    · ${criterio.rotulo}`)
  } else {
    linha('    · nenhum critério marcado')
  }
  const capacidade = resultado.capacidade
  linha(
    `  Capacidade funcional: ${capacidade.met != null ? `${capacidade.met} MET` : 'não informada'}` +
      (capacidade.met != null
        ? ` (${capacidade.adequada ? 'adequada' : 'abaixo do corte'})`
        : ''),
  )
  linha(`    regra: ${capacidade.regra.nome} — corte em ${capacidade.corte} MET`)
  if (capacidade.atividade) linha(`    referência: ${capacidade.atividade}`)
  linha()

  const comorbidades = ficha.comorbidades ?? []
  if (comorbidades.length > 0) {
    linha('COMORBIDADES REGISTRADAS')
    for (const comorbidade of comorbidades) {
      const catalogo = meta.comorbidades?.find((item) => item.id === comorbidade.id)
      const cid = catalogo?.cid?.[0]?.codigo
      linha(
        `  · ${catalogo?.rotulo ?? comorbidade.id}${cid ? ` (CID ${cid})` : ''} — ` +
          `${comorbidade.controlado ? 'controlada' : 'NÃO CONTROLADA'}`,
      )
    }
    linha()
  }

  if (resultado.alertas.length > 0) {
    linha('MANEJO DE MEDICAÇÃO')
    for (const alerta of resultado.alertas) {
      linha(`  · ${alerta.rotulo} [peso ${alerta.peso}]`)
      linha(`    em uso: ${alerta.medicamentos.join(', ')}`)
      linha(`    conduta: ${alerta.conduta}`)
    }
    linha()
  } else if ((ficha.medicamentos ?? []).length === 0) {
    linha('MANEJO DE MEDICAÇÃO')
    linha('  · nenhuma medicação registrada')
    linha()
  }

  if (resultado.encaminhamentos.length > 0) {
    linha('ENCAMINHAMENTOS')
    for (const encaminhamento of resultado.encaminhamentos) {
      linha(`  · ${encaminhamento.especialidade} (${encaminhamento.comorbidade})`)
    }
    linha()
  }

  if (resultado.pendencias.length > 0) {
    linha(`PENDÊNCIAS — ${resultado.pendencias.length} item(ns) não informados`)
    for (const pendencia of resultado.pendencias) {
      linha(`  · ${pendencia.campo}: ${pendencia.porque}`)
    }
    linha()
  }

  linha('-'.repeat(46))
  linha('Triagem de apoio à decisão. A conduta final é do profissional.')
  linha('Cortes e regras estão declarados na ferramenta e sujeitos a conferência')
  linha('na diretriz vigente da instituição.')

  return linhas.join('\n')
}
