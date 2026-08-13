import { client } from './client'
import type { MaiaCapabilitySnapshot, MaiaHotkeyStatus, MaiaVoiceConfig } from '@shared/index'

export type MaiaVoiceTestResult =
  | { ok: true; provider: 'openai' | 'say' }
  | { ok: false; error: string }

export const servicoMaia = {
  capabilities: () =>
    client['maia.capabilities.status']() as Promise<MaiaCapabilitySnapshot>,

  hotkeys: () =>
    client['maia.hotkeys.status']() as Promise<MaiaHotkeyStatus>,

  voiceObter: () =>
    client['maia.voice.obter']() as Promise<MaiaVoiceConfig>,

  voiceSalvar: (patch: Partial<MaiaVoiceConfig>) =>
    client['maia.voice.salvar'](patch) as Promise<MaiaVoiceConfig>,

  voiceTestar: (input?: { text?: string }) =>
    client['maia.voice.testar'](input ?? {}) as Promise<MaiaVoiceTestResult>,
}
