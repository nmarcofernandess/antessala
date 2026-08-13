import { speakViaProvider } from './tts/openai-tts'

const LITERAL_TTS_INSTRUCTIONS = [
  'Leia literalmente em portugues brasileiro.',
  'Nao resuma, nao explique, nao comente e nao altere o sentido.',
  'Apenas adapte ritmo e pausas para leitura natural.',
].join(' ')

export async function readLiteralText(input: { text: string }): Promise<{ spoken: true }> {
  const text = input.text.trim()
  if (!text) throw new Error('Selecione um texto antes de chamar a Maia.')

  await speakViaProvider({
    text,
    instructions: LITERAL_TTS_INSTRUCTIONS,
  })

  return { spoken: true }
}
