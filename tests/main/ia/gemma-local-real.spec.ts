import fs from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import {
  LOCAL_MODELS,
  detectVisionSupport,
  getMmprojPath,
  getModelPath,
  localLlmChat,
} from '../../../src/main/ia/local-llm'
import { findLlamaServerBinary, stopLocalLlamaServer } from '../../../src/main/ia/llama-server-runtime'

// Prova REAL gated: sobe um llama-server e carrega o GGUF de ~3GB, então fica
// FORA do `npm test` padrão (P5: nada flaky/caro no caminho default). Roda só com
// opt-in explícito FLOWKIT_REAL_AI_TESTS=1 E modelo+binário presentes. É o que a
// Monday roda na validação (T8) e qualquer um reproduz com a flag.
function isLocalModelPresent(): boolean {
  try {
    const p = getModelPath('gemma-4-e2b-it-q4')
    return fs.existsSync(p) && fs.statSync(p).size > LOCAL_MODELS['gemma-4-e2b-it-q4'].size_bytes * 0.95
  } catch {
    return false
  }
}

const canRunLocal =
  process.env.FLOWKIT_REAL_AI_TESTS === '1' && isLocalModelPresent() && !!findLlamaServerBinary()

describe.skipIf(!canRunLocal)('Gemma 4 local — prova real', () => {
  afterAll(async () => {
    await stopLocalLlamaServer()
  })

  it('responde uma pergunta de texto offline com resposta não-vazia', async () => {
    const result = await localLlmChat(
      'Responda em uma frase curta: para que serve um nutricionista?',
      [],
      'real-gemma-text',
      undefined,
      undefined,
      undefined,
      { modelId: 'gemma-4-e2b-it-q4' },
    )

    expect(result.resposta.trim().length).toBeGreaterThan(0)
  }, 240_000)

  it('reporta visão de forma honesta (liga só com mmproj presente)', async () => {
    const support = await detectVisionSupport('gemma-4-e2b-it-q4')
    const mmprojPath = getMmprojPath('gemma-4-e2b-it-q4')
    const mmprojPresent = !!mmprojPath && fs.existsSync(mmprojPath)

    if (mmprojPresent) {
      expect(support.ok).toBe(true)
    } else {
      expect(support.ok).toBe(false)
      expect(support.reason).toBeTruthy()
    }
  }, 240_000)
})
