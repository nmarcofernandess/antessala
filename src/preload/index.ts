import { contextBridge, ipcRenderer } from 'electron'
import { isActiveIpcChannel } from '../shared/active-ipc-channels'

function assertActiveIpcChannel(channel: unknown): asserts channel is string {
  if (!isActiveIpcChannel(channel)) {
    throw new Error('Canal IPC indisponível.')
  }
}

// Keep the renderer bridge smaller than Electron's ipcRenderer surface.
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      assertActiveIpcChannel(channel)
      return ipcRenderer.invoke(channel, ...args)
    },
  },
})
