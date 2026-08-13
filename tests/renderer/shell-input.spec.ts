import { describe, expect, it } from 'vitest'
import { looksLikeChatMessage } from '@/lib/shell-input'

describe('terminal shell input guard', () => {
  it('blocks natural language that would otherwise be sent to zsh', () => {
    expect(looksLikeChatMessage('e ai mano')).toBe(true)
    expect(looksLikeChatMessage('qual o status do sistema?')).toBe(true)
  })

  it('allows ordinary shell commands', () => {
    expect(looksLikeChatMessage('pwd')).toBe(false)
    expect(looksLikeChatMessage('ls -la')).toBe(false)
    expect(looksLikeChatMessage('npm test')).toBe(false)
    expect(looksLikeChatMessage('cat package.json | jq .name')).toBe(false)
  })
})
