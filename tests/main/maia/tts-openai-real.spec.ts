import { describe, expect, it } from 'vitest'

// Prova REAL de voz: chama a OpenAI TTS de verdade e gasta créditos. Fica fora
// do `npm test` padrão — roda só com opt-in FLOWKIT_REAL_AI_TESTS=1 E a chave
// OPENAI_API_KEY presente (ela vive em ~/.zshrc.local, fora do env padrão).
const canRunOpenAi = process.env.FLOWKIT_REAL_AI_TESTS === '1' && !!process.env.OPENAI_API_KEY

describe.skipIf(!canRunOpenAi)('OpenAI TTS — prova real', () => {
  it('gera um WAV real (header RIFF/WAVE) com bytes de áudio suficientes', async () => {
    const { synthesizeOpenAiSpeechWav } = await import('../../../src/main/maia/tts/openai-tts')

    const buffer = await synthesizeOpenAiSpeechWav({
      text: 'Olá Marco, aqui é a Maiá testando a voz da OpenAI.',
      apiKey: process.env.OPENAI_API_KEY as string,
      voice: 'nova',
      model: 'gpt-4o-mini-tts',
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(2000)
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(buffer.subarray(8, 12).toString('ascii')).toBe('WAVE')
  }, 60_000)
})
