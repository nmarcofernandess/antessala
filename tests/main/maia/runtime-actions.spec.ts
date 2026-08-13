import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureSelectedText: vi.fn(),
  capturePrimaryDisplayScreenshot: vi.fn(),
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

vi.mock('../../../src/main/maia/literal-reading', () => ({
  readLiteralText: mocks.readLiteralText,
}))

vi.mock('../../../src/main/maia/contextual-flow', () => ({
  runContextualQuestion: mocks.runContextualQuestion,
}))

vi.mock('../../../src/main/maia/capabilities', () => ({
  getMaiaCapabilities: mocks.getMaiaCapabilities,
}))

const screenshotOutcome = {
  ok: true,
  value: {
    id: 'img-1',
    tipo: 'image',
    mime_type: 'image/png',
    nome: 'maia-screenshot.png',
    tamanho_bytes: 4,
    data_base64: 'ZmFrZQ==',
  },
}

describe('Maiá runtime actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.captureSelectedText.mockResolvedValue({ ok: true, value: 'texto selecionado' })
    mocks.capturePrimaryDisplayScreenshot.mockResolvedValue(screenshotOutcome)
    mocks.readLiteralText.mockResolvedValue({ spoken: true })
    mocks.runContextualQuestion.mockResolvedValue({
      conversaId: 'conv-1',
      resposta: 'ok',
      outputMode: 'voice',
    })
    // Por padrão a visão está disponível (Screen Recording + rota com visão).
    mocks.getMaiaCapabilities.mockResolvedValue({ supportsScreenshot: true })
  })

  it('reads literal selected text without contextual chat', async () => {
    const { runLiteralReadAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runLiteralReadAction({})

    expect(mocks.readLiteralText).toHaveBeenCalledWith({ text: 'texto selecionado' })
    expect(mocks.runContextualQuestion).not.toHaveBeenCalled()
    expect(result.textLength).toBe('texto selecionado'.length)
  })

  it('asks contextual questions with captured selection and screenshot when vision is supported', async () => {
    const { runContextualAskAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runContextualAskAction({ prompt: 'O que respondo?' })

    expect(mocks.runContextualQuestion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'O que respondo?',
      selectedText: 'texto selecionado',
      screenshotAttachment: expect.objectContaining({ tipo: 'image' }),
      outputMode: 'voice',
    }))
    expect(result.captured).toEqual({ selectedText: true, screenshot: true })
  })

  it('never captures or sends a screenshot when vision is unsupported (honest gating)', async () => {
    mocks.getMaiaCapabilities.mockResolvedValue({ supportsScreenshot: false })
    const { runContextualAskAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runContextualAskAction({ prompt: 'O que respondo?' })

    expect(mocks.capturePrimaryDisplayScreenshot).not.toHaveBeenCalled()
    expect(mocks.runContextualQuestion).toHaveBeenCalledWith(expect.objectContaining({
      screenshotAttachment: null,
    }))
    expect(result.captured.screenshot).toBe(false)
  })

  it('does not fake an image: when vision is supported but capture fails, asks text-only and declares screenshot:false', async () => {
    mocks.getMaiaCapabilities.mockResolvedValue({ supportsScreenshot: true })
    mocks.capturePrimaryDisplayScreenshot.mockResolvedValue({ ok: false, reason: 'no-source', message: 'Nenhuma tela disponível.' })
    const { runContextualAskAction } = await import('../../../src/main/maia/runtime-actions')

    const result = await runContextualAskAction({ prompt: 'O que respondo?' })

    // tentou (visão prometida), mas não inventa imagem: segue sem anexo e declara honesto
    expect(mocks.capturePrimaryDisplayScreenshot).toHaveBeenCalled()
    expect(mocks.runContextualQuestion).toHaveBeenCalledWith(expect.objectContaining({ screenshotAttachment: null }))
    expect(result.captured.screenshot).toBe(false)
  })

  it('summarizes captured input through the same FlowKit contextual flow', async () => {
    const { runContextualSummarizeAction } = await import('../../../src/main/maia/runtime-actions')

    await runContextualSummarizeAction({ outputMode: 'text' })

    expect(mocks.runContextualQuestion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Resuma o conteudo capturado'),
      selectedText: 'texto selecionado',
      outputMode: 'text',
    }))
    expect(mocks.capturePrimaryDisplayScreenshot).not.toHaveBeenCalled()
  })
})
