import type { AiRouteResolution } from '../../shared/ia-routing-contract'
import type {
  MaiaCapabilitySnapshot,
  MaiaVisionReadiness,
  MaiaVoiceReadiness,
} from '../../shared/maia-mvp-contract'
import { resolveIaRoute } from '../ia/routing'
import { getMaiaPermissionStatus } from './permissions'
import { getMaiaHotkeyStatus } from './hotkeys'
import { getMaiaVoiceConfig } from './voice-config'

// A voz é "pronta" quando o provedor configurado tem o que precisa. No MVP,
// OpenAI exige a chave; sem ela a UI pede a chave (o runtime ainda cai no `say`,
// mas a capacidade-headline "voz OpenAI" só liga com chave).
async function resolveVoiceReadiness(): Promise<MaiaVoiceReadiness> {
  const config = await getMaiaVoiceConfig()
  if (config.provider === 'openai') {
    return config.api_key.trim()
      ? { provider: 'openai', ready: true }
      : { provider: 'openai', ready: false, reason: 'Configure a chave OpenAI em Configurações → Voz da Maiá.' }
  }
  return { provider: config.provider, ready: false, reason: 'Provedor de voz não suportado no MVP.' }
}

// Visão real do route resolvido: Gemini é multimodal (nuvem-com-visão); local
// depende do mmproj + probe (detectVisionSupport); OpenRouter fica off no MVP
// (não dá pra garantir visão genericamente). Nunca finge enxergar.
async function resolveVisionReadiness(route: AiRouteResolution): Promise<MaiaVisionReadiness> {
  if (!route.ok || !route.provider) {
    return { ok: false, source: null, reason: route.message || 'Rota de IA da Maiá não está pronta.' }
  }

  if (route.provider === 'gemini') {
    return { ok: true, source: 'route' }
  }

  if (route.provider === 'local') {
    const { detectVisionSupport, asLocalModelId } = await import('../ia/local-llm')
    // asLocalModelId lança para modelo fora do catálogo — defensivo: a snapshot
    // nunca quebra por isso, reporta visão off com motivo.
    let modelId: ReturnType<typeof asLocalModelId> | undefined
    try {
      modelId = route.model ? asLocalModelId(route.model) : undefined
    } catch (err) {
      return { ok: false, source: null, reason: (err as Error).message }
    }
    const support = await detectVisionSupport(modelId)
    return support.ok
      ? { ok: true, source: 'local' }
      : { ok: false, source: null, reason: support.reason }
  }

  return { ok: false, source: null, reason: 'Provedor da rota não oferece visão no MVP.' }
}

// Snapshot honesto E leve: a UI só ativa o que cada bloco reportar como pronto.
// `validateLocal: false` de propósito — o snapshot roda a cada mount de página e
// abertura da barra (deve ser instantâneo); NÃO podemos subir o llama-server de
// ~3GB aqui. A validação real (boot + smoke) acontece no uso, em
// runContextualQuestion → assertIaRouteReady (validateLocal padrão true), que
// devolve o erro acionável se o modelo não carregar.
export async function getMaiaCapabilities(): Promise<MaiaCapabilitySnapshot> {
  const [permissions, hotkeys, route, voice] = await Promise.all([
    getMaiaPermissionStatus(),
    Promise.resolve(getMaiaHotkeyStatus()),
    resolveIaRoute('maia_command', { validateLocal: false }),
    resolveVoiceReadiness(),
  ])

  const vision = await resolveVisionReadiness(route)

  return {
    permissions: { screen: permissions.screen, accessibility: permissions.accessibility },
    hotkeys,
    route,
    voice,
    vision,
    contextualActions: route.ok ? { ok: true } : { ok: false, reason: route.message },
    supportsScreenshot: vision.ok && permissions.screen === 'granted',
  }
}
