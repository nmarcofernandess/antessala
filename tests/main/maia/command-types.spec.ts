import { describe, expect, it } from 'vitest'

describe('Maia command contract', () => {
  it('builds the default Discord reply command', async () => {
    const { createDefaultDiscordReplyCommand } = await import('../../../src/main/maia/command-types')

    expect(createDefaultDiscordReplyCommand('O que eu devo responder?')).toEqual({
      kind: 'ask',
      prompt: 'O que eu devo responder?',
      inputSources: {
        selection: true,
        clipboard: true,
        screenshot: true,
      },
      output: 'voice',
      openChatAfter: false,
    })
  })
})
