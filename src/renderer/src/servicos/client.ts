import { createClient } from '@egoist/tipc/renderer'
import type { Router } from '../../../main/tipc'

export const client = createClient<Router>({
  ipcInvoke: (channel, ...args) => {
    const invoke = globalThis.window?.electron?.ipcRenderer?.invoke
    if (!invoke) return Promise.reject(new Error('Bridge Electron indisponível.'))
    return invoke(channel, ...args)
  },
})
