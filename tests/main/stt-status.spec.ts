import { describe, expect, it } from 'vitest'
import { getSttStatus, transcribeWavBase64 } from '../../src/main/stt/download'
import { transcribeWithSidecar } from '../../src/main/stt/stt-bridge'

describe('STT status', () => {
  it('reports sidecar and model readiness separately', () => {
    const status = getSttStatus()
    const model = status.modelos['parakeet-v3-int8']

    expect(typeof status.sidecar_disponivel).toBe('boolean')
    expect(model.source).toMatch(/^(bundled|user|missing)$/)
    expect(model.path).toBe(model.runtime_path)
    expect(model.install_path).toContain('parakeet-tdt-0.6b-v3-int8')
    expect(model.deletable).toBe(model.source === 'user')
    expect(model.downloadable).toBe(model.source !== 'bundled')
    expect(status.disponivel).toBe(status.sidecar_disponivel && model.baixado)
    if (status.sidecar_disponivel && !model.baixado) {
      expect(status.reason).toBe('download_stt_model')
    }
  })

  it('reports a missing explicit sidecar path clearly', async () => {
    await expect(transcribeWithSidecar({
      sidecarPath: '/tmp/escalaflow-stt-does-not-exist',
      audioPath: '/tmp/audio.wav',
      modelPath: '/tmp/model',
      modelId: 'parakeet-v3-int8',
    })).rejects.toThrow('/tmp/escalaflow-stt-does-not-exist')
  })

  it('rejects oversized base64 audio before touching model or sidecar', async () => {
    await expect(transcribeWavBase64({
      wav_base64: 'a'.repeat(3_000_001),
    })).rejects.toThrow('Audio muito longo')
  })

  it('rejects STT post-processing instead of pretending it ran', async () => {
    await expect(transcribeWavBase64({
      wav_base64: 'UklGRg==',
      post_process: true,
      post_process_mode: 'clean_prompt',
    })).rejects.toThrow('transcript-first')
  })
})
