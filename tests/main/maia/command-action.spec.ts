import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureSelectedText: vi.fn(),
  capturePrimaryDisplayScreenshot: vi.fn(),
  readClipboardText: vi.fn(),
  writeClipboardText: vi.fn(),
  pasteClipboardText: vi.fn(),
  replaceSelectedText: vi.fn(),
  readLiteralText: vi.fn(),
  runContextualQuestion: vi.fn(),
  getMaiaCapabilities: vi.fn(),
}))

vi.mock('../../../src/main/maia/capture/clipboard-selection', () => ({
  captureSelectedText: mocks.captureSelectedText,
}))

vi.mock('../../../src/main/maia/capture/screenshot', () => ({
  capturePrimaryDisplayScreenshot: mocks.capturePrimaryDisplayScreenshot,
}))

vi.mock('../../../src/main/maia/capabilities', () => ({
  getMaiaCapabilities: mocks.getMaiaCapabilities,
}))

vi.mock('../../../src/main/maia/capture/clipboard', () => ({
  readClipboardText: mocks.readClipboardText,
  writeClipboardText: mocks.writeClipboardText,
  pasteClipboardText: mocks.pasteClipboardText,
  replaceSelectedText: mocks.replaceSelectedText,
}))

vi.mock('../../../src/main/maia/literal-reading', () => ({
  readLiteralText: mocks.readLiteralText,
}))

vi.mock('../../../src/main/maia/contextual-flow', () => ({
  runContextualQuestion: mocks.runContextualQuestion,
}))

describe('Maia command action runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.captureSelectedText.mockResolvedValue({ ok: true, value: 'mensagem selecionada' })
    mocks.capturePrimaryDisplayScreenshot.mockResolvedValue({
      ok: true,
      value: {
        id: 'shot-1',
        tipo: 'image',
        mime_type: 'image/png',
        nome: 'maia-screenshot.png',
        tamanho_bytes: 4,
        data_base64: 'AQIDBA==',
      },
    })
    mocks.getMaiaCapabilities.mockResolvedValue({ supportsScreenshot: true })
    mocks.readClipboardText.mockResolvedValue('texto do clipboard')
    mocks.runContextualQuestion.mockResolvedValue({
      conversaId: 'conv-1',
      resposta: 'Responda com calma e objetividade.',
      outputMode: 'text',
    })
    mocks.readLiteralText.mockResolvedValue({ spoken: true })
  })

  it('asks what to answer using selection, clipboard, screenshot, and FlowKit chat', async () => {
    const { runMaiaCommandAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runMaiaCommandAction({
      kind: 'ask',
      prompt: 'O que eu devo responder?',
      inputSources: { selection: true, clipboard: true, screenshot: true },
      output: 'voice',
      openChatAfter: false,
    })

    expect(mocks.runContextualQuestion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'O que eu devo responder?',
      selectedText: 'mensagem selecionada',
      manualText: expect.stringContaining('texto do clipboard'),
      screenshotAttachment: expect.objectContaining({ tipo: 'image' }),
      outputMode: 'voice',
    }))
    expect(result.conversaId).toBe('conv-1')
    expect(result.captured).toEqual({ selection: true, clipboard: true, screenshot: true })
  })

  it('dictates clipboard without creating a FlowKit conversation', async () => {
    const { runMaiaCommandAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runMaiaCommandAction({
      kind: 'dictate_clipboard',
      prompt: '',
      inputSources: { selection: false, clipboard: true, screenshot: false },
      output: 'voice',
      openChatAfter: false,
    })

    expect(mocks.readLiteralText).toHaveBeenCalledWith({ text: 'texto do clipboard' })
    expect(mocks.runContextualQuestion).not.toHaveBeenCalled()
    expect(result.sideEffects.spoke).toBe(true)
  })

  it('copies contextual answer to clipboard', async () => {
    const { runMaiaCommandAction } = await import('../../../src/main/maia/runtime-actions')

    await runMaiaCommandAction({
      kind: 'summarize_clipboard',
      prompt: '',
      inputSources: { selection: false, clipboard: true, screenshot: false },
      output: 'copy',
      openChatAfter: false,
    })

    expect(mocks.writeClipboardText).toHaveBeenCalledWith('Responda com calma e objetividade.')
  })

  it('replaces selected text with contextual answer', async () => {
    const { runMaiaCommandAction } = await import('../../../src/main/maia/runtime-actions')

    await runMaiaCommandAction({
      kind: 'draft_reply',
      prompt: 'Escreva a resposta final.',
      inputSources: { selection: true, clipboard: true, screenshot: true },
      output: 'replace',
      openChatAfter: false,
    })

    expect(mocks.replaceSelectedText).toHaveBeenCalledWith('Responda com calma e objetividade.')
  })

  it('exposes command execution through the FlowKit IPC router', async () => {
    const { router } = await import('../../../src/main/tipc')

    expect(router['maia.command.run']).toBeTruthy()
    expect(router['maia.permissions.status']).toBeTruthy()
    expect(router['maia.permissions.promptAccessibility']).toBeTruthy()
    expect(router['maia.commandBar.open']).toBeTruthy()
    expect(router['maia.commandBar.close']).toBeTruthy()
  })
})
