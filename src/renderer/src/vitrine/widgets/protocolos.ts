/**
 * Protocolos no renderer: materialização.
 *
 * As composições em si moram em `src/shared/protocolos.ts`, porque o main
 * precisa delas para semear o banco no primeiro boot. Aqui fica só o que
 * depende do registro de widgets — transformar uma lista de tipos em blocos de
 * verdade, com dados próprios e identificadores novos.
 */

import { widgetPorTipo, type Bloco } from './registro'

export {
  ID_PROTOCOLO_GERAL,
  PROTOCOLOS,
  PROTOCOLOS_FIXTURE,
  PROTOCOLO_GERAL,
  protocoloPara,
  type Protocolo,
} from '@shared/protocolos'
import type { Protocolo } from '@shared/protocolos'

/**
 * Materializa os blocos do protocolo.
 *
 * Cada aplicação gera identificadores próprios: aplicar o mesmo protocolo duas
 * vezes no mesmo caso não pode produzir dois blocos com o mesmo id, que é o
 * defeito que o composer do DietFlow carrega ao copiar ids do template.
 */
let sequencia = 0

export function aplicar(protocolo: Protocolo): Bloco[] {
  return protocolo.blocos
    .filter((tipo) => widgetPorTipo(tipo))
    .map((tipo) => ({
      id: `${tipo}__${++sequencia}`,
      tipo,
      dados: widgetPorTipo(tipo)!.dadosIniciais(),
    }))
}

/** Acrescenta ao caso só os blocos do protocolo que ainda não estão lá. */
export function acrescentarFaltantes(protocolo: Protocolo, atuais: Bloco[]): Bloco[] {
  const presentes = new Set(atuais.map((b) => b.tipo))
  const novos = protocolo.blocos
    .filter((tipo) => !presentes.has(tipo) && widgetPorTipo(tipo))
    .map((tipo) => ({
      id: `${tipo}__${++sequencia}`,
      tipo,
      dados: widgetPorTipo(tipo)!.dadosIniciais(),
    }))
  return [...atuais, ...novos]
}
