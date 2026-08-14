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

export function calcularRequisito(blocos: Bloco[]): Requisito {
  const sinais: Sinal[] = []
  const pendentes: string[] = []
  let dominiosPagos = 0

  for (const b of blocos) {
    const def = widgetPorTipo(b.tipo)
    if (!def) continue

    const dados = b.dados as never
    if (!def.tratado(dados)) pendentes.push(def.nome)

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
