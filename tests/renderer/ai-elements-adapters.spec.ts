import { describe, expect, it } from 'vitest'
import {
  mapFlowMessageParts,
  mapStoredMessageToUiMessage,
  mapVoiceCaptureSnapshot,
} from '../../src/renderer/src/lib/ai-elements-adapters'
import type { IaMensagem } from '../../src/shared/types'

describe('ai elements adapters', () => {
  it('maps stored assistant markdown into a UIMessage text part', () => {
    const msg: IaMensagem = {
      id: 'm1',
      papel: 'assistente',
      conteudo: '# Ola\n\nTexto',
      timestamp: '2026-06-14T00:00:00.000Z',
    }

    expect(mapStoredMessageToUiMessage(msg)).toMatchObject({
      id: 'm1',
      role: 'assistant',
      parts: [{ type: 'text', text: '# Ola\n\nTexto', state: 'done' }],
    })
  })

  it('keeps direct stored messages as text-only UI parts', () => {
    const msg: IaMensagem = {
      id: 'm2',
      papel: 'assistente',
      conteudo: 'ok',
      timestamp: '2026-06-14T00:00:00.000Z',
    }

    expect(mapFlowMessageParts(msg)).toEqual([{ type: 'text', text: 'ok', state: 'done' }])
  })

  it('maps transcript-first voice capture without post-processing claims', () => {
    expect(mapVoiceCaptureSnapshot({
      recording: false,
      transcribing: false,
      text: 'texto literal',
      postProcessed: false,
    })).toEqual({
      status: 'ready',
      transcript: 'texto literal',
      postProcessed: false,
      label: 'Transcrição local',
    })
  })
})
