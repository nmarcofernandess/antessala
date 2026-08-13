import { knowledgeClient } from './knowledge-client'
import type { IaMemoria } from '@shared/types'

export const servicoMemorias = {
  listar: () =>
    knowledgeClient['ia.memorias.listar']() as Promise<IaMemoria[]>,

  salvar: (input: { id?: number; conteudo: string }) =>
    knowledgeClient['ia.memorias.salvar'](input) as Promise<IaMemoria>,

  remover: (id: number) =>
    knowledgeClient['ia.memorias.remover']({ id }) as Promise<void>,

  contar: () =>
    knowledgeClient['ia.memorias.contar']() as Promise<{ total: number; limite: number }>,

  getMemoriaAutomatica: async (): Promise<boolean> => {
    const result = await knowledgeClient['ia.config.memoriaAutomatica']({}) as { memoria_automatica: boolean }
    return result.memoria_automatica
  },

  setMemoriaAutomatica: async (valor: boolean): Promise<boolean> => {
    const result = await knowledgeClient['ia.config.memoriaAutomatica']({ valor }) as { memoria_automatica: boolean }
    return result.memoria_automatica
  },
}
