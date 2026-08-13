import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  execFile: vi.fn(),
  readClipboardText: vi.fn(),
  writeClipboardText: vi.fn(),
}))

vi.mock('electron', () => ({ clipboard: { clear: mocks.clear } }))
vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('../../../src/main/maia/capture/clipboard', () => ({
  readClipboardText: mocks.readClipboardText,
  writeClipboardText: mocks.writeClipboardText,
}))

describe('captureSelectedText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeClipboardText.mockResolvedValue(undefined)
    // execFile é promisificado; sucesso = callback(null)
    mocks.execFile.mockImplementation((_cmd: string, _args: string[], cb: (e: Error | null) => void) => cb(null))
  })

  it('captures the selection and restores the previous clipboard', async () => {
    mocks.readClipboardText.mockResolvedValueOnce('CLIP_ANTERIOR').mockResolvedValueOnce('TEXTO SELECIONADO')
    const { captureSelectedText } = await import('../../../src/main/maia/capture/clipboard-selection')

    const outcome = await captureSelectedText()

    expect(outcome).toEqual({ ok: true, value: 'TEXTO SELECIONADO' })
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('CLIP_ANTERIOR')
  })

  it('reports empty when nothing is selected (clipboard só whitespace)', async () => {
    mocks.readClipboardText.mockResolvedValueOnce('CLIP_ANTERIOR').mockResolvedValueOnce('   ')
    const { captureSelectedText } = await import('../../../src/main/maia/capture/clipboard-selection')

    const outcome = await captureSelectedText()

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('empty')
    // restaura mesmo no caso vazio
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('CLIP_ANTERIOR')
  })

  it('reports permission and restores the clipboard when osascript fails (sem Acessibilidade)', async () => {
    mocks.readClipboardText
      .mockResolvedValueOnce('CLIP_ANTERIOR') // previousText
      .mockResolvedValueOnce('') // dentro do catch: clipboard ficou limpo (clear), != previousText
    mocks.execFile.mockImplementation((_cmd: string, _args: string[], cb: (e: Error | null) => void) =>
      cb(new Error('not authorized to send Apple events')),
    )
    const { captureSelectedText } = await import('../../../src/main/maia/capture/clipboard-selection')

    const outcome = await captureSelectedText()

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('permission')
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('CLIP_ANTERIOR')
  })
})
