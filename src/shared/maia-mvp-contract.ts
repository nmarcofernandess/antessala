import type { AiRouteResolution } from './ia-routing-contract'

// Espelha o union de src/main/maia/permissions.ts sem arrastar a dependência de
// electron para o renderer. permissions.ts pode passar a importar daqui.
export type MaiaPermissionState = 'granted' | 'denied' | 'not-determined' | 'unknown'

// ── Voz (TTS) ────────────────────────────────────────────────────────────────
// MVP: só OpenAI, provado e testado. Arquitetura de lista pronta para o roadmap
// (Gemini etc.) — basta acrescentar uma entrada em MAIA_TTS_PROVIDERS.

export type MaiaTtsProviderId = 'openai'

export const MAIA_OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const

export type MaiaOpenAiVoice = (typeof MAIA_OPENAI_VOICES)[number]

export interface MaiaTtsProviderInfo {
  id: MaiaTtsProviderId
  label: string
  voices: readonly string[]
  models: readonly string[]
}

// Lista-ready: o renderer monta o select de provedor/voz a partir daqui.
export const MAIA_TTS_PROVIDERS: readonly MaiaTtsProviderInfo[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    voices: MAIA_OPENAI_VOICES,
    models: ['gpt-4o-mini-tts'],
  },
] as const

export interface MaiaVoiceConfig {
  provider: MaiaTtsProviderId
  api_key: string
  voice: string
  model: string
  speed: number
}

export const DEFAULT_MAIA_VOICE_CONFIG: MaiaVoiceConfig = {
  provider: 'openai',
  api_key: '',
  voice: 'nova',
  model: 'gpt-4o-mini-tts',
  speed: 1.15,
}

export const MAIA_VOICE_CONFIG_KEY = 'maia_voice'

// ── Capability snapshot ───────────────────────────────────────────────────────
// A honestidade: a UI só oferece/ativa o que cada bloco reportar como pronto.

export interface MaiaHotkeyBinding {
  accelerator: string
  registered: boolean
}

export interface MaiaHotkeyStatus {
  literalReading: MaiaHotkeyBinding
  commandBar: MaiaHotkeyBinding
}

// Discriminated unions: o tipo carrega a invariante (pronto ⟺ sem motivo; não
// pronto ⟹ motivo obrigatório). Sem isso, estados impossíveis ficam represent-
// áveis e os call sites viram guards defensivos à mão.
export type MaiaVoiceReadiness =
  | { provider: MaiaTtsProviderId; ready: true }
  | { provider: MaiaTtsProviderId; ready: false; reason: string }

export type MaiaVisionReadiness =
  // source: 'route' = nuvem-com-visão; 'local' = Gemma + mmproj.
  | { ok: true; source: 'route' | 'local' }
  | { ok: false; source: null; reason: string }

export type MaiaContextualReadiness =
  | { ok: true }
  | { ok: false; reason: string }

export interface MaiaCapabilitySnapshot {
  permissions: {
    screen: MaiaPermissionState
    accessibility: MaiaPermissionState
  }
  hotkeys: MaiaHotkeyStatus
  route: AiRouteResolution
  voice: MaiaVoiceReadiness
  vision: MaiaVisionReadiness
  // Ações geradas (Perguntar/Resumir/Rascunhar) só liberam se a rota está pronta.
  contextualActions: MaiaContextualReadiness
  // Só verdadeiro quando há visão real (route OU local) E Screen Recording concedido.
  supportsScreenshot: boolean
}

// ── Resultado de captura honesto ──────────────────────────────────────────────
// Substitui o "throw silencioso": cada captura diz se conseguiu e por quê não.
// União discriminada: sucesso sempre traz value; falha sempre traz reason.

export type MaiaCaptureFailureReason = 'empty' | 'permission' | 'no-source' | 'error'

export type MaiaCaptureOutcome<T = string> =
  | { ok: true; value: T }
  | { ok: false; reason: MaiaCaptureFailureReason; message?: string }
