import { createClient } from '@egoist/tipc/renderer'
import type { Router } from '../../../main/tipc'

/**
 * Fora do shell do Electron (inspeção visual no browser de dev) `window.electron`
 * não existe. A ponte falha na chamada, nunca no import, para que a árvore React
 * ainda monte e as telas possam ser inspecionadas.
 */
const ponte = window.electron?.ipcRenderer

export const client = createClient<Router>({
  ipcInvoke: ponte
    ? ponte.invoke
    : () => Promise.reject(new Error('IPC indisponível fora do Electron')),
})
