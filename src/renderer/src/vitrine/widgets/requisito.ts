/**
 * Requisito operacional da consulta — réplica da regra `demo-workload-v1` que
 * vive em `src/shared/mvp/workflow.ts`.
 *
 * Vinte minutos de base. Cada domínio com achado positivo soma cinco, e no
 * máximo três domínios pagam — o quarto em diante bate no teto e soma zero,
 * porque a entrevista não cresce indefinidamente com a lista de queixas.
 * Volume de medicação e de diagnóstico somam cinco cada. A acomodação soma
 * dez e não entra no teto, porque ela não é sobre conversar: é sobre a sala.
 */

import { widgetPorTipo, type Bloco } from './registro'
import type { Protocolo } from './protocolos'

export type ClasseVaga = 'RAPIDA' | 'NORMAL' | 'ESTENDIDA' | 'FORA_DA_FAIXA'

export const CLASSES: Record<
  ClasseVaga,
  { nome: string; buffer: number; tom: string; ponto: string }
> = {
  RAPIDA: {
    nome: 'Vaga rápida',
    buffer: 5,
    tom: 'border-success/30 bg-success/10 text-success',
    ponto: 'bg-success',
  },
  NORMAL: {
    nome: 'Vaga normal',
    buffer: 5,
    tom: 'border-primary/25 bg-primary/10 text-primary',
    ponto: 'bg-primary',
  },
  ESTENDIDA: {
    nome: 'Vaga estendida',
    buffer: 10,
    tom: 'border-warning/30 bg-warning/10 text-warning',
    ponto: 'bg-warning',
  },
  FORA_DA_FAIXA: {
    nome: 'Fora do alcance da demonstração',
    buffer: 10,
    tom: 'border-destructive/30 bg-destructive/10 text-destructive',
    ponto: 'bg-destructive',
  },
}

export const BASE_MINUTOS = 20
export const TETO_DOMINIOS = 3

export type Sinal = {
  rotulo: string
  origem: string
  minutos: number
  noTeto?: boolean
}

export type Requisito = {
  minutos: number
  classe: ClasseVaga
  sinais: Sinal[]
  /** Blocos que ainda não receberam tratamento — bloqueiam a publicação. */
  pendentes: string[]
  explicacao: string
}

/**
 * A completude é do protocolo aplicado, não de uma matriz global.
 *
 * Emenda de produto de 14/08/2026: o contrato dizia que omitir widget de um
 * template não relaxava a completude — a matriz dos quatorze valia sempre. O
 * dono do produto decidiu o contrário para esta fase: cada protocolo tem sua
 * composição, e **incluído é obrigatório**. Bloco fora da composição não
 * bloqueia a publicação, e bloco acrescentado depois é complementar — não vira
 * obrigatório retroativamente.
 *
 * O cálculo de minutos não muda: base, teto de três domínios, volume e
 * acomodação continuam como na regra `demo-workload-v1`.
 */
export function calcularRequisito(blocos: Bloco[], protocolo: Protocolo): Requisito {
  const sinais: Sinal[] = []
  let dominiosPagos = 0

  const exigidos = new Set(protocolo.blocos)
  const tratadosPorTipo = new Map<string, boolean>()

  for (const b of blocos) {
    const def = widgetPorTipo(b.tipo)
    if (!def) continue

    const dados = b.dados as never

    // Só o que o protocolo pede entra na completude. Um bloco do protocolo
    // aparecendo duas vezes conta como tratado se qualquer instância estiver.
    if (exigidos.has(b.tipo)) {
      tratadosPorTipo.set(b.tipo, (tratadosPorTipo.get(b.tipo) ?? false) || def.tratado(dados))
    }

    const temSinal = def.sinal?.(dados) ?? false
    if (!temSinal) continue

    if (def.minutosForaDoTeto) {
      sinais.push({
        rotulo: def.nome,
        origem: def.resumo(dados),
        minutos: def.minutosForaDoTeto,
      })
      continue
    }

    if (def.dominio) {
      if (dominiosPagos < TETO_DOMINIOS) {
        sinais.push({ rotulo: def.nome, origem: def.resumo(dados), minutos: 5 })
        dominiosPagos++
      } else {
        sinais.push({ rotulo: def.nome, origem: def.resumo(dados), minutos: 0, noTeto: true })
      }
      continue
    }

    // Volume: medicação e diagnóstico somam uma vez, sem entrar no teto.
    sinais.push({ rotulo: def.nome, origem: def.resumo(dados), minutos: 5 })
  }

  // Pendência é bloco que o protocolo pede e o caso não resolveu — seja porque
  // ninguém respondeu, seja porque o bloco foi removido do caso.
  const pendentes = protocolo.blocos
    .filter((tipo) => !tratadosPorTipo.get(tipo))
    .map((tipo) => widgetPorTipo(tipo)?.nome)
    .filter((nome): nome is string => !!nome)

  const minutos = BASE_MINUTOS + sinais.reduce((s, x) => s + x.minutos, 0)
  const classe: ClasseVaga =
    minutos === BASE_MINUTOS
      ? 'RAPIDA'
      : minutos <= 35
        ? 'NORMAL'
        : minutos <= 50
          ? 'ESTENDIDA'
          : 'FORA_DA_FAIXA'

  const pagos = sinais.filter((s) => s.minutos > 0)

  return {
    minutos,
    classe,
    sinais,
    pendentes,
    explicacao: pagos.length
      ? `Base de ${BASE_MINUTOS} min mais ${pagos.map((s) => `${s.rotulo.toLowerCase()} (+${s.minutos})`).join(', ')}.`
      : `Base de ${BASE_MINUTOS} min. Nenhum achado somou tempo.`,
  }
}
