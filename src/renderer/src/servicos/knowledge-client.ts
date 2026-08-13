import { createClient } from '@egoist/tipc/renderer'
import type { DormantKnowledgeRouter } from '../../../main/knowledge/router'

/**
 * Contrato compilável das superfícies de Memória ainda ocultas. A existência do
 * client e do router IPC não publica rota nem coloca trabalho no boot.
 */
export const knowledgeClient = createClient<DormantKnowledgeRouter>({
  ipcInvoke: window.electron.ipcRenderer.invoke,
})
