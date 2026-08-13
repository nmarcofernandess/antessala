import { execute, queryOne } from '../db/query'
import {
  DEFAULT_MAIA_VOICE_CONFIG,
  MAIA_TTS_PROVIDERS,
  MAIA_VOICE_CONFIG_KEY,
  type MaiaTtsProviderId,
  type MaiaVoiceConfig,
} from '../../shared/maia-mvp-contract'

const KNOWN_PROVIDERS = new Set<MaiaTtsProviderId>(MAIA_TTS_PROVIDERS.map((p) => p.id))

function safeParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch (err) {
    // Não engole calado: um JSON corrompido faz ESTE read cair no default (o
    // valor no banco continua intacto — não deletamos), então deixa rastro de
    // por quê a config apareceu "sumida" naquele carregamento.
    console.error(`[maia] config de voz (key ${MAIA_VOICE_CONFIG_KEY}) corrompida, usando default neste read:`, (err as Error).message)
    return {}
  }
}

// PGlite devolve JSONB já parseado (objeto), mas DBs antigos ou drivers podem
// devolver string — tratamos os dois sem mentir sobre o conteúdo.
function normalize(raw: unknown): MaiaVoiceConfig {
  const obj: Record<string, unknown> =
    typeof raw === 'string' ? safeParse(raw) : raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const provider =
    typeof obj.provider === 'string' && KNOWN_PROVIDERS.has(obj.provider as MaiaTtsProviderId)
      ? (obj.provider as MaiaTtsProviderId)
      : DEFAULT_MAIA_VOICE_CONFIG.provider

  // voice/model precisam existir NO provider resolvido — config velha com voz
  // de outro provider 400a na API; cai no default em vez de vazar.
  const providerInfo = MAIA_TTS_PROVIDERS.find((p) => p.id === provider) ?? MAIA_TTS_PROVIDERS[0]
  const voice =
    typeof obj.voice === 'string' && providerInfo.voices.includes(obj.voice) ? obj.voice : DEFAULT_MAIA_VOICE_CONFIG.voice
  const model =
    typeof obj.model === 'string' && providerInfo.models.includes(obj.model) ? obj.model : DEFAULT_MAIA_VOICE_CONFIG.model

  return {
    provider,
    api_key: typeof obj.api_key === 'string' ? obj.api_key : DEFAULT_MAIA_VOICE_CONFIG.api_key,
    voice,
    model,
    speed: typeof obj.speed === 'number' && Number.isFinite(obj.speed) ? obj.speed : DEFAULT_MAIA_VOICE_CONFIG.speed,
  }
}

export async function getMaiaVoiceConfig(): Promise<MaiaVoiceConfig> {
  const row = await queryOne<{ key: string; value: unknown }>(
    'SELECT key, value FROM config WHERE key = $1',
    MAIA_VOICE_CONFIG_KEY,
  )
  if (!row || row.value == null) return { ...DEFAULT_MAIA_VOICE_CONFIG }
  return normalize(row.value)
}

// Salva mesclando sobre a config atual. Atenção: o resultado passa por
// normalize() — um provider/voz/modelo fora do catálogo é silenciosamente
// trocado pelo default (o retorno reflete o que de fato foi salvo, não o patch).
export async function saveMaiaVoiceConfig(patch: Partial<MaiaVoiceConfig>): Promise<MaiaVoiceConfig> {
  const current = await getMaiaVoiceConfig()
  const next = normalize({ ...current, ...patch })
  await execute(
    `INSERT INTO config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    MAIA_VOICE_CONFIG_KEY,
    JSON.stringify(next),
  )
  return next
}
