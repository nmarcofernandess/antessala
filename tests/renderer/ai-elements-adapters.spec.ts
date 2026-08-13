import { describe, expect, it } from 'vitest'
import { mapVoiceCaptureSnapshot } from '../../src/renderer/src/lib/ai-elements-adapters'

describe('ai elements adapters', () => {
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
