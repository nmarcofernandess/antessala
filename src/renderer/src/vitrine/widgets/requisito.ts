/**
 * Requisito na tela.
 *
 * A regra `demo-workload-v1` mora em `@shared/clinical/carga` e é executada pelo
 * processo principal — é ele quem publica requisito. Aqui ficam só os tokens
 * visuais das classes e o adaptador que reexibe o cálculo enquanto a enfermagem
 * digita, para que o número na tela nunca apareça sem explicação.
 */

import { calcularRequisito as calcular, type ClasseVaga } from '@shared/clinical/carga'
import type { Bloco } from './registro'
import type { Protocolo } from './protocolos'

export {
  BASE_MINUTOS,
  TETO_DOMINIOS,
  type ClasseVaga,
  type Requisito,
  type Sinal,
} from '@shared/clinical/carga'

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

/** Prévia local do que o main vai calcular quando a anamnese for publicada. */
export function calcularRequisito(blocos: Bloco[], protocolo: Protocolo) {
  return calcular(blocos, protocolo.blocos)
}
