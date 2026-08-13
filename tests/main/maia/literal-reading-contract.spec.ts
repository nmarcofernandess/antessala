import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  speakViaProvider: vi.fn(),
  createFlowKitConversation: vi.fn(),
}))

vi.mock('../../../src/main/maia/tts/openai-tts', () => ({
  speakViaProvider: mocks.speakViaProvider,
}))

vi.mock('../../../src/main/maia/flowkit-chat-adapter', () => ({
  createFlowKitConversation: mocks.createFlowKitConversation,
}))

describe('Maiá literal reading contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.speakViaProvider.mockResolvedValue({ spoken: true, provider: 'openai' })
  })

  it('speaks selected text through the voice provider without creating a FlowKit conversation', async () => {
    const { readLiteralText } = await import('../../../src/main/maia/literal-reading')

    await readLiteralText({ text: 'Leia isto literalmente.' })

    expect(mocks.speakViaProvider).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Leia isto literalmente.',
    }))
    expect(mocks.createFlowKitConversation).not.toHaveBeenCalled()
  })
})
