import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readText: vi.fn(),
  writeText: vi.fn(),
  clear: vi.fn(),
  execFile: vi.fn((_cmd: string, _args: string[], callback: (err: Error | null) => void) => callback(null)),
}))

vi.mock('electron', () => ({
  clipboard: {
    readText: mocks.readText,
    writeText: mocks.writeText,
    clear: mocks.clear,
  },
}))

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile,
}))

describe('Maia clipboard helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readText.mockReturnValue('texto do clipboard')
  })

  it('reads trimmed clipboard text', async () => {
    mocks.readText.mockReturnValue('  texto do clipboard  ')
    const { readClipboardText } = await import('../../../src/main/maia/capture/clipboard')

    await expect(readClipboardText()).resolves.toBe('texto do clipboard')
  })

  it('writes clipboard text', async () => {
    const { writeClipboardText } = await import('../../../src/main/maia/capture/clipboard')

    await writeClipboardText('resposta')

    expect(mocks.writeText).toHaveBeenCalledWith('resposta')
  })

  it('pastes current clipboard through Cmd+V', async () => {
    const { pasteClipboardText } = await import('../../../src/main/maia/capture/clipboard')

    await pasteClipboardText()

    expect(mocks.execFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', 'tell application "System Events" to keystroke "v" using command down'],
      expect.any(Function),
    )
  })

  it('replaces selected text by writing response, pasting it, and restoring old clipboard', async () => {
    const { replaceSelectedText } = await import('../../../src/main/maia/capture/clipboard')

    await replaceSelectedText('nova resposta')

    expect(mocks.writeText).toHaveBeenNthCalledWith(1, 'nova resposta')
    expect(mocks.execFile).toHaveBeenCalled()
    expect(mocks.writeText).toHaveBeenLastCalledWith('texto do clipboard')
  })
})
