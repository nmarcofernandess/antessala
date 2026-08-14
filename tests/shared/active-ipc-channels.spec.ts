import { describe, expect, it } from 'vitest'
import {
  ACTIVE_IPC_CHANNELS,
  isActiveIpcChannel,
} from '../../src/shared/active-ipc-channels'

describe('active IPC channels', () => {
  it('keeps one unique, closed list for the published shell', () => {
    expect(new Set(ACTIVE_IPC_CHANNELS).size).toBe(ACTIVE_IPC_CHANNELS.length)
    expect(isActiveIpcChannel('ia.chat.enviar')).toBe(true)
    expect(isActiveIpcChannel('app:version')).toBe(true)
    expect(isActiveIpcChannel('knowledge.stats')).toBe(true)
    expect(isActiveIpcChannel('knowledge.importarCompleto')).toBe(true)
    expect(isActiveIpcChannel('knowledge.listarChunks')).toBe(true)
    expect(isActiveIpcChannel('knowledge.enrich')).toBe(true)
    expect(isActiveIpcChannel('knowledge.demo.seed')).toBe(false)
    expect(isActiveIpcChannel('knowledge.graphData')).toBe(true)
  })

  it.each([
    'ia.memorias.listar',
    'ia.config.memoriaAutomatica',
    'knowledge.rebuildAndExportSistema',
    'registros.salvarAnamnese',
    'catalogos.cid10.buscar',
    'export.imprimirPDF',
    'ia.stt.download',
    '',
    null,
  ])('rejects unpublished or privileged channel %j', (channel) => {
    expect(isActiveIpcChannel(channel)).toBe(false)
  })
})
