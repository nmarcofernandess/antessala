import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    callback(null, '', '')
  }),
  writeFile: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile,
}))

vi.mock('node:fs/promises', () => ({
  writeFile: mocks.writeFile,
  rm: mocks.rm,
}))

describe('Maiá TTS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.rm.mockResolvedValue(undefined)
  })

  it('speaks text through macOS say instead of only generating audio bytes', async () => {
    const { speakText } = await import('../../../src/main/maia/tts/openai-tts')

    const result = await speakText({ text: 'Olá Marco', speed: 1.2 })

    expect(result).toEqual({ spoken: true })
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining('maia-speech-'), 'Olá Marco', 'utf8')
    expect(mocks.execFile).toHaveBeenCalledWith('say', expect.arrayContaining(['-f']), expect.any(Function))
    expect(mocks.rm).toHaveBeenCalledWith(expect.stringContaining('maia-speech-'), { force: true })
  })
})
