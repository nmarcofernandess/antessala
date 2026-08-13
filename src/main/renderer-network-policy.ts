import type { Session } from 'electron'

export const REMOTE_RENDERER_URLS = [
  'http://*/*',
  'https://*/*',
  'ws://*/*',
  'wss://*/*',
] as const

const protectedSessions = new WeakSet<Session>()

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function isDevelopmentEndpoint(url: string, developmentRendererUrl: string | undefined): boolean {
  if (!developmentRendererUrl) return false
  try {
    const request = new URL(url)
    const development = new URL(developmentRendererUrl)
    return request.hostname === development.hostname && request.port === development.port
  } catch {
    return false
  }
}

/**
 * A janela principal não precisa buscar recursos remotos. Em desenvolvimento,
 * somente a origem exata do electron-vite é liberada para página e HMR.
 * Chamadas voluntárias aos provedores de IA acontecem no processo main e não
 * passam pela sessão do renderer.
 */
export function shouldBlockRendererRequest(url: string, developmentRendererUrl?: string): boolean {
  const requestOrigin = originOf(url)
  if (!requestOrigin) return false

  const protocol = new URL(url).protocol
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol)) return false

  return !isDevelopmentEndpoint(url, developmentRendererUrl)
}

/** Impede que Markdown da IA dispare handlers de outros aplicativos via URL customizada. */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function installRendererNetworkPolicy(
  session: Session,
  developmentRendererUrl?: string,
): void {
  if (protectedSessions.has(session)) return

  session.webRequest.onBeforeRequest(
    { urls: [...REMOTE_RENDERER_URLS] },
    (details, callback) => {
      callback({ cancel: shouldBlockRendererRequest(details.url, developmentRendererUrl) })
    },
  )
  protectedSessions.add(session)
}
