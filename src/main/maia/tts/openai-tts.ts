import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { MaiaVoiceConfig } from '../../../shared/maia-mvp-contract'
import { getMaiaVoiceConfig } from '../voice-config'
import { playAudioFile } from './play-audio'

const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts'
const DEFAULT_INSTRUCTIONS = 'Leia em portugues brasileiro, com clareza e ritmo natural.'
const execFileAsync = promisify(execFile)

export interface SpeakTextInput {
  text: string
  speed?: number
}

export interface SynthesizeOpenAiSpeechInput {
  text: string
  apiKey: string
  voice?: string
  model?: string
  speed?: number
  instructions?: string
}

export interface SpeakViaProviderInput {
  text: string
  config?: MaiaVoiceConfig
  instructions?: string
}

export interface SpeakViaProviderResult {
  spoken: true
  provider: 'openai' | 'say'
}

// Gera áudio WAV real via OpenAI TTS. A chave vem da config de voz (nunca de env).
// WAV é tocável direto pelo `afplay`, sem decodificação no renderer.
export async function synthesizeOpenAiSpeechWav(input: SynthesizeOpenAiSpeechInput): Promise<Buffer> {
  const text = input.text.trim()
  if (!text) throw new Error('Texto vazio.')

  const apiKey = input.apiKey?.trim()
  if (!apiKey) throw new Error('Chave OpenAI ausente para a voz da Maiá.')

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model?.trim() || DEFAULT_TTS_MODEL,
      voice: input.voice?.trim() || 'nova',
      input: text,
      instructions: input.instructions ?? DEFAULT_INSTRUCTIONS,
      response_format: 'wav',
      speed: input.speed ?? 1.15,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `OpenAI recusou a chave de voz (${response.status}). Confira a chave em Configurações → Voz da Maiá.`,
      )
    }
    throw new Error(`Falha ao gerar voz OpenAI (${response.status}): ${body.slice(0, 300)}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

// Fala via `say` do macOS (fallback honesto quando não há chave/provedor de voz).
export async function speakText(input: SpeakTextInput): Promise<{ spoken: true }> {
  const text = input.text.trim()
  if (!text) throw new Error('Texto vazio.')

  const filePath = path.join(os.tmpdir(), `maia-speech-${randomUUID()}.txt`)
  await writeFile(filePath, text, 'utf8')
  try {
    const rate = String(Math.round((input.speed ?? 1.15) * 185))
    await execFileAsync('say', ['-r', rate, '-f', filePath])
  } finally {
    await rm(filePath, { force: true })
  }

  return { spoken: true }
}

// Ponto único de fala da Maiá: decide pelo MaiaVoiceConfig.
// OpenAI com chave → WAV real + afplay. Sem chave (ou provedor sem suporte) → `say`.
export async function speakViaProvider(input: SpeakViaProviderInput): Promise<SpeakViaProviderResult> {
  const text = input.text.trim()
  if (!text) throw new Error('Texto vazio.')

  const config = input.config ?? (await getMaiaVoiceConfig())

  if (config.provider === 'openai' && config.api_key.trim()) {
    const audio = await synthesizeOpenAiSpeechWav({
      text,
      apiKey: config.api_key,
      voice: config.voice,
      model: config.model,
      speed: config.speed,
      instructions: input.instructions,
    })
    const filePath = path.join(os.tmpdir(), `maia-speech-${randomUUID()}.wav`)
    await writeFile(filePath, audio)
    try {
      await playAudioFile(filePath)
    } finally {
      await rm(filePath, { force: true })
    }
    return { spoken: true, provider: 'openai' }
  }

  await speakText({ text, speed: config.speed })
  return { spoken: true, provider: 'say' }
}
